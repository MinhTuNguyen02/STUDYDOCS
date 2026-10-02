import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;
  private bucketName: string;
  private supabaseUrl: string;
  private bucketReady = false;

  constructor(private configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL', '');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', '');
    this.bucketName = this.configService.get<string>('SUPABASE_STORAGE_BUCKET', 'studydocs');

    this.supabase = createClient(this.supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }

  async onModuleInit() {
    if (this.configService.get<string>('NODE_ENV') === 'test') return;
    await this.ensureBucket();
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    try {
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      if (listError) {
        this.logger.error(`Không thể liệt kê buckets: ${listError.message}`);
        return;
      }
      const exists = buckets?.some((b) => b.name === this.bucketName);
      if (!exists) {
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 100 * 1024 * 1024
        });
        if (createError) {
          this.logger.error(`Không thể tạo bucket: ${createError.message}`);
          return;
        }
        this.logger.log(`Bucket "${this.bucketName}" đã được tạo thành công.`);
      } else {
        this.logger.log(`Bucket "${this.bucketName}" đã tồn tại.`);
      }
      this.bucketReady = true;
    } catch (error) {
      this.logger.error(
        'Lỗi khi khởi tạo bucket.',
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  async uploadFile(objectName: string, buffer: Buffer, mimetype: string): Promise<string> {
    await this.ensureBucket();
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(objectName, buffer, {
          contentType: mimetype,
          upsert: false
        });

      if (error) throw error;
      return objectName;
    } catch (e: any) {
      this.logger.error('Upload lên storage thất bại.', e instanceof Error ? e.stack : undefined);
      throw new InternalServerErrorException(
        'Lỗi upload file lên Supabase Storage: ' + (e.message || '')
      );
    }
  }

  async getPresignedUrl(objectName: string, expiryInSeconds = 3600): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(objectName, expiryInSeconds);

      if (error) throw error;
      return data.signedUrl;
    } catch (err: any) {
      this.logger.error('Không thể tạo signed URL.', err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException('Không lấy được URL tải về từ Supabase Storage');
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage.from(this.bucketName).remove([objectName]);
      if (error) this.logger.warn(`Không thể xóa object storage: ${error.message}`);
      else this.logger.log(`Đã xóa object storage: ${objectName}`);
    } catch (err: any) {
      // Non-fatal: just log, don't throw — the document action already succeeded
      this.logger.error(
        'Xóa object storage thất bại.',
        err instanceof Error ? err.stack : undefined
      );
    }
  }

  getPublicUrl(objectName: string): string {
    const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(objectName);
    return data.publicUrl;
  }

  getStorageBaseUrl(): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}`;
  }

  async healthCheck(): Promise<boolean> {
    const { data, error } = await this.supabase.storage.listBuckets();
    return !error && Boolean(data?.some((bucket) => bucket.name === this.bucketName));
  }
}
