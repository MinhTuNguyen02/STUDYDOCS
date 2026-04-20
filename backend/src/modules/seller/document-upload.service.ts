import { Injectable, BadRequestException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { createHash } from 'crypto';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as sharp from 'sharp';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class DocumentUploadService {
  constructor(private readonly storageService: StorageService) { }

  async processAndUploadDocument(
    file: Express.Multer.File,
    slug: string,
    providedExtension: string
  ) {
    if (file.size > 100 * 1024 * 1024) throw new BadRequestException('File qua lon (>100MB).');

    // 3.4 Hash
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    // Parsing and checking extensions
    const extMatch = file.originalname.match(/\.[0-9a-z]+$/i);
    let extension = extMatch ? extMatch[0].replace('.', '').toLowerCase() : providedExtension.toLowerCase();

    let pageCount = 0;
    let previewBuffer: Buffer | null = null;
    let reviewBuffer: Buffer | null = null;
    let pdfBufferToParse: Buffer | null = null;

    // Convert logic
    if (extension === 'pdf') {
      pdfBufferToParse = file.buffer;
    } else {
      try {
        const formData = new FormData();
        const safeFilename = file.originalname.includes('.') ? file.originalname : `${file.originalname}.${extension}`;
        formData.append('files', file.buffer, { filename: safeFilename });

        const gotenbergUrl = process.env.GOTENBERG_URL || 'http://localhost:3000';
        const response = await axios.post(`${gotenbergUrl}/forms/libreoffice/convert`, formData, {
          headers: formData.getHeaders(),
          responseType: 'arraybuffer'
        });
        pdfBufferToParse = Buffer.from(response.data);
      } catch (e) {
        console.error('Gotenberg conversion error (fallback to placeholder):', e);
      }
    }

    // Document parsing for PDF Buffer
    if (pdfBufferToParse) {
      try {
        const processed = await this.processPdfBuffer(pdfBufferToParse);
        pageCount = processed.pageCount;
        previewBuffer = processed.previewBuffer;
        reviewBuffer = processed.reviewBuffer;
      } catch (e) {
        if (extension === 'pdf') {
          throw new BadRequestException('Khong the doc file PDF nay.');
        } else {
          console.error('Pdf parse error on converted file:', e);
        }
      }
    }

    // Upload main document
    const ts = Date.now();
    const fileKey = `docs/${slug}-${ts}.${extension}`;
    await this.storageService.uploadFile(fileKey, file.buffer, file.mimetype);

    // Upload preview (30% + watermark — for buyers to sample)
    let previewKey = `previews/placeholder.png`;
    if (previewBuffer) {
      previewKey = `previews/${slug}-${ts}.pdf`;
      await this.storageService.uploadFile(previewKey, previewBuffer, 'application/pdf');
    }

    // Upload review (100% + light watermark — for staff moderation only, deleted after decision)
    let reviewKey: string | null = null;
    if (reviewBuffer) {
      reviewKey = `reviews/${slug}-${ts}.pdf`;
      await this.storageService.uploadFile(reviewKey, reviewBuffer, 'application/pdf');
    }

    return {
      fileKey,
      previewKey,
      reviewKey,
      pageCount,
      fileHash,
      fileSize: file.size,
      extension
    };
  }

  private async processPdfBuffer(buffer: Buffer): Promise<{ pageCount: number, previewBuffer: Buffer, reviewBuffer: Buffer }> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ── 1. REVIEW PDF — Full pages, light diagonal watermark ──
    const reviewPdf = await PDFDocument.create();
    const reviewFont = await reviewPdf.embedFont(StandardFonts.HelveticaBold);
    const allPageIndices = Array.from({ length: totalPages }, (_, i) => i);
    const reviewCopied = await reviewPdf.copyPages(pdfDoc, allPageIndices);

    for (const page of reviewCopied) {
      const { width, height } = page.getSize();
      const text = 'STUDYDOCS - STAFF REVIEW';
      const size = 42;
      const textWidth = reviewFont.widthOfTextAtSize(text, size);
      const textHeight = reviewFont.heightAtSize(size);
      const angle = -35;
      const angleRad = (angle * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const x = cx - (textWidth / 2) * Math.cos(angleRad) + (textHeight / 2) * Math.sin(angleRad);
      const y = cy - (textWidth / 2) * Math.sin(angleRad) - (textHeight / 2) * Math.cos(angleRad);

      page.drawText(text, {
        x, y, size,
        font: reviewFont,
        color: rgb(0.1, 0.4, 0.9),
        rotate: degrees(angle),
        opacity: 0.15   // Very light — readable but doesn't obstruct content
      });
      reviewPdf.addPage(page);
    }

    // ── 2. PREVIEW PDF — 30% pages, strong red watermark for buyers ──
    const previewCount = Math.max(1, Math.floor(totalPages * 0.3));
    const previewPdf = await PDFDocument.create();
    const previewFont = await previewPdf.embedFont(StandardFonts.HelveticaBold);
    const previewText = 'STUDYDOCS';
    const previewSize = 70;

    const previewCopied = await previewPdf.copyPages(pdfDoc, Array.from({ length: previewCount }, (_, i) => i));

    for (const page of previewCopied) {
      const { width, height } = page.getSize();
      const textWidth = previewFont.widthOfTextAtSize(previewText, previewSize);
      const textHeight = previewFont.heightAtSize(previewSize);
      const angle = -45;
      const angleRad = (angle * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const x = cx - (textWidth / 2) * Math.cos(angleRad) + (textHeight / 2) * Math.sin(angleRad);
      const y = cy - (textWidth / 2) * Math.sin(angleRad) - (textHeight / 2) * Math.cos(angleRad);

      page.drawText(previewText, {
        x, y,
        size: previewSize,
        font: previewFont,
        color: rgb(0.95, 0.1, 0.1),
        rotate: degrees(angle),
        opacity: 0.3
      });
      previewPdf.addPage(page);
    }

    const reviewSaved = await reviewPdf.save();
    const previewSaved = await previewPdf.save();

    return {
      pageCount: totalPages,
      previewBuffer: Buffer.from(previewSaved),
      reviewBuffer: Buffer.from(reviewSaved)
    };
  }
}
