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
    let pdfBufferToParse: Buffer | null = null;

    // Convert logic
    if (extension === 'pdf') {
      pdfBufferToParse = file.buffer;
    } else {
      try {
        const formData = new FormData();
        const safeFilename = file.originalname.includes('.') ? file.originalname : `${file.originalname}.${extension}`;
        formData.append('files', file.buffer, { filename: safeFilename });

        const response = await axios.post('http://localhost:3000/forms/libreoffice/convert', formData, {
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
      } catch (e) {
        if (extension === 'pdf') {
          throw new BadRequestException('Khong the doc file PDF nay.');
        } else {
          console.error('Pdf parse error on converted file:', e);
        }
      }
    }

    // Upload main document
    const fileKey = `docs/${slug}-${Date.now()}.${extension}`;
    await this.storageService.uploadFile(fileKey, file.buffer, file.mimetype);

    // Upload preview
    let previewKey = `previews/placeholder.png`;
    if (previewBuffer) {
      previewKey = `previews/${slug}-${Date.now()}.pdf`;
      await this.storageService.uploadFile(previewKey, previewBuffer, 'application/pdf');
    }

    return {
      fileKey,
      previewKey,
      pageCount,
      fileHash,
      fileSize: file.size,
      extension
    };
  }

  private async processPdfBuffer(buffer: Buffer): Promise<{ pageCount: number, previewBuffer: Buffer }> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    // Lay 30% so trang
    const previewCount = Math.max(1, Math.floor(totalPages * 0.3));

    const previewPdf = await PDFDocument.create();

    const copiedPages = await previewPdf.copyPages(
      pdfDoc,
      Array.from({ length: previewCount }, (_, i) => i)
    );

    const font = await previewPdf.embedFont(StandardFonts.HelveticaBold);
    const text = 'STUDYDOCS';
    const size = 70;

    // Tính chính xác chiều rộng và chiều cao của text
    const textWidth = font.widthOfTextAtSize(text, size);
    const textHeight = font.heightAtSize(size);

    for (const page of copiedPages) {
      const { width, height } = page.getSize();

      // 2. Lấy tọa độ tâm của trang
      const centerX = width / 2;
      const centerY = height / 2;

      // 3. Quy đổi góc xoay sang Radian để dùng Math.sin và Math.cos
      const angle = -45;
      const angleRad = (angle * Math.PI) / 180;

      // 4. Công thức lượng giác dịch chuyển tọa độ x, y để tâm chữ vào giữa
      const x = centerX - (textWidth / 2) * Math.cos(angleRad) + (textHeight / 2) * Math.sin(angleRad);
      const y = centerY - (textWidth / 2) * Math.sin(angleRad) - (textHeight / 2) * Math.cos(angleRad);

      page.drawText(text, {
        x: x,
        y: y,
        size: size,
        font: font, // Truyền font vào để chữ đẹp và khớp với kích thước tính toán
        color: rgb(0.95, 0.1, 0.1),
        rotate: degrees(angle),
        opacity: 0.3
      });

      previewPdf.addPage(page);
    }

    const saved = await previewPdf.save();
    return { pageCount: totalPages, previewBuffer: Buffer.from(saved) };
  }
}
