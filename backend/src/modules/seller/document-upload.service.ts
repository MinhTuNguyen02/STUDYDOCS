import {
  Injectable,
  BadRequestException,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class DocumentUploadService {
  private readonly logger = new Logger(DocumentUploadService.name);
  private readonly maxPageCount = 1_000;

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {}

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
    const extension = extMatch
      ? extMatch[0].replace('.', '').toLowerCase()
      : providedExtension.toLowerCase();
    this.assertSupportedFile(file, extension, providedExtension);

    let pageCount = 0;
    let previewBuffer: Buffer | null = null;
    let reviewBuffer: Buffer | null = null;
    let pdfBufferToParse: Buffer | null = null;

    // Convert logic
    if (extension === 'pdf') {
      pdfBufferToParse = file.buffer;
    } else {
      const safeFilename = file.originalname.includes('.')
        ? file.originalname
        : `${file.originalname}.${extension}`;
      const gotenbergUrl = this.configService
        .getOrThrow<string>('GOTENBERG_URL')
        .replace(/\/$/, '');

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const formData = new FormData();
          formData.append('files', file.buffer, { filename: safeFilename });
          const response = await axios.post(`${gotenbergUrl}/forms/libreoffice/convert`, formData, {
            headers: formData.getHeaders(),
            responseType: 'arraybuffer',
            timeout: 45_000,
            maxBodyLength: 100 * 1024 * 1024,
            maxContentLength: 150 * 1024 * 1024
          });
          pdfBufferToParse = Buffer.from(response.data);
          break;
        } catch {
          this.logger.warn(`Gotenberg conversion attempt ${attempt}/2 failed.`);
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
      }
      if (!pdfBufferToParse) {
        throw new ServiceUnavailableException(
          'Không thể chuyển đổi tài liệu lúc này. Vui lòng thử lại sau.'
        );
      }
    }

    // Document parsing for PDF Buffer
    if (pdfBufferToParse) {
      try {
        const processed = await this.processPdfBuffer(pdfBufferToParse);
        pageCount = processed.pageCount;
        previewBuffer = processed.previewBuffer;
        reviewBuffer = processed.reviewBuffer;
      } catch {
        if (extension === 'pdf') {
          throw new BadRequestException('Khong the doc file PDF nay.');
        }
        throw new ServiceUnavailableException(
          'File sau chuyển đổi không hợp lệ. Vui lòng thử lại.'
        );
      }
    }

    if (!previewBuffer || !reviewBuffer || pageCount < 1) {
      throw new BadRequestException('Không thể tạo bản xem trước cho tài liệu.');
    }

    // Upload main document
    const ts = Date.now();
    const fileKey = `docs/${slug}-${ts}.${extension}`;
    const previewKey = `previews/${slug}-${ts}.pdf`;
    const reviewKey = `reviews/${slug}-${ts}.pdf`;
    const uploadedKeys: string[] = [];
    try {
      await this.storageService.uploadFile(fileKey, file.buffer, file.mimetype);
      uploadedKeys.push(fileKey);
      await this.storageService.uploadFile(previewKey, previewBuffer, 'application/pdf');
      uploadedKeys.push(previewKey);
      await this.storageService.uploadFile(reviewKey, reviewBuffer, 'application/pdf');
      uploadedKeys.push(reviewKey);
    } catch (error) {
      await Promise.all(uploadedKeys.map((key) => this.storageService.deleteFile(key)));
      throw error;
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

  async cleanupUpload(upload: { fileKey: string; previewKey: string; reviewKey: string | null }) {
    const keys = [upload.fileKey, upload.previewKey, upload.reviewKey].filter(
      (key): key is string => Boolean(key) && key !== 'previews/placeholder.png'
    );
    await Promise.all(keys.map((key) => this.storageService.deleteFile(key)));
  }

  private assertSupportedFile(
    file: Express.Multer.File,
    extension: string,
    providedExtension: string
  ) {
    const allowed = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']);
    if (!allowed.has(extension) || extension !== providedExtension.toLowerCase()) {
      throw new BadRequestException('Phần mở rộng của file không hợp lệ hoặc không khớp biểu mẫu.');
    }

    const header = file.buffer.subarray(0, 8);
    const isPdf = header.subarray(0, 5).toString('ascii') === '%PDF-';
    const isZip =
      header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
    const isLegacyOffice = header.equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    );

    if (extension === 'pdf' && !isPdf) {
      throw new BadRequestException('Nội dung file không phải PDF hợp lệ.');
    }
    if (['docx', 'pptx', 'xlsx'].includes(extension) && !isZip) {
      throw new BadRequestException('File Office Open XML không hợp lệ.');
    }
    if (['doc', 'ppt', 'xls'].includes(extension) && !isLegacyOffice) {
      throw new BadRequestException('File Office legacy không hợp lệ.');
    }

    const allowedMimeTypes: Record<string, string[]> = {
      pdf: ['application/pdf'],
      doc: ['application/msword', 'application/octet-stream'],
      docx: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/octet-stream'
      ],
      ppt: ['application/vnd.ms-powerpoint', 'application/octet-stream'],
      pptx: [
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/octet-stream'
      ],
      xls: ['application/vnd.ms-excel', 'application/octet-stream'],
      xlsx: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream'
      ]
    };
    if (!allowedMimeTypes[extension]?.includes(file.mimetype)) {
      throw new BadRequestException('MIME type của file không phù hợp với định dạng đã chọn.');
    }
  }

  private async processPdfBuffer(
    buffer: Buffer
  ): Promise<{ pageCount: number; previewBuffer: Buffer; reviewBuffer: Buffer }> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    if (totalPages < 1 || totalPages > this.maxPageCount) {
      throw new BadRequestException(`Tài liệu phải có từ 1 đến ${this.maxPageCount} trang.`);
    }

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
        x,
        y,
        size,
        font: reviewFont,
        color: rgb(0.1, 0.4, 0.9),
        rotate: degrees(angle),
        opacity: 0.15 // Very light — readable but doesn't obstruct content
      });
      reviewPdf.addPage(page);
    }

    // ── 2. PREVIEW PDF — 30% pages, strong red watermark for buyers ──
    const previewCount = Math.max(1, Math.floor(totalPages * 0.3));
    const previewPdf = await PDFDocument.create();
    const previewFont = await previewPdf.embedFont(StandardFonts.HelveticaBold);
    const previewText = 'STUDYDOCS';
    const previewSize = 70;

    const previewCopied = await previewPdf.copyPages(
      pdfDoc,
      Array.from({ length: previewCount }, (_, i) => i)
    );

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
        x,
        y,
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
