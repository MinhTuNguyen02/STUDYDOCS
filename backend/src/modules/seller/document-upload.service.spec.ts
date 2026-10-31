import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { DocumentUploadService } from './document-upload.service';

function file(buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'document.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: null as never
  };
}

describe('DocumentUploadService storage pipeline', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('http://gotenberg.test') };

  it('rejects a spoofed PDF before writing to storage', async () => {
    const storage = { uploadFile: jest.fn(), deleteFile: jest.fn() };
    const service = new DocumentUploadService(storage as never, config as never);

    await expect(
      service.processAndUploadDocument(file(Buffer.from('not a pdf')), 'spoofed', 'pdf')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('rolls back objects already uploaded when a later upload fails', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const buffer = Buffer.from(await pdf.save());
    const storage = {
      uploadFile: jest
        .fn()
        .mockResolvedValueOnce('original')
        .mockResolvedValueOnce('preview')
        .mockRejectedValueOnce(new Error('review upload failed')),
      deleteFile: jest.fn().mockResolvedValue(undefined)
    };
    const service = new DocumentUploadService(storage as never, config as never);

    await expect(service.processAndUploadDocument(file(buffer), 'valid', 'pdf')).rejects.toThrow(
      'review upload failed'
    );
    expect(storage.deleteFile).toHaveBeenCalledTimes(2);
    expect(storage.deleteFile.mock.calls.map(([key]) => String(key).split('/')[0])).toEqual([
      'docs',
      'previews'
    ]);
  });
});
