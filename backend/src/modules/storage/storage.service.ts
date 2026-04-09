import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
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
    await this.ensureBucket();
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    try {
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      if (listError) {
        console.error('[Storage] Không thể liệt kê buckets:', listError.message);
        return;
      }
      const exists = buckets?.some(b => b.name === this.bucketName);
      if (!exists) {
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 100 * 1024 * 1024
        });
        if (createError) {
          console.error('[Storage] Không thể tạo bucket:', createError.message);
          return;
        }
        console.log(`[Storage] Bucket "${this.bucketName}" đã được tạo thành công.`);
      } else {
        console.log(`[Storage] Bucket "${this.bucketName}" đã tồn tại.`);
      }
      this.bucketReady = true;
    } catch (error) {
      console.error('[Storage] Lỗi khi khởi tạo bucket:', error);
    }
  }

  async uploadFile(objectName: string, buffer: Buffer, mimetype: string): Promise<string> {
    await this.ensureBucket();
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(objectName, buffer, {
          contentType: mimetype,
          upsert: true
        });

      if (error) throw error;
      return objectName;
    } catch (e: any) {
      console.error('[Storage] Upload error:', e.message || e);
      throw new InternalServerErrorException('Lỗi upload file lên Supabase Storage: ' + (e.message || ''));
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
      console.error('[Storage] Presigned URL error:', err.message || err);
      throw new InternalServerErrorException('Không lấy được URL tải về từ Supabase Storage');
    }
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([objectName]);
      if (error) console.warn('[Storage] Delete file warning:', error.message);
      else console.log(`[Storage] Deleted: ${objectName}`);
    } catch (err: any) {
      // Non-fatal: just log, don't throw — the document action already succeeded
      console.error('[Storage] deleteFile error:', err.message || err);
    }
  }

  getPublicUrl(objectName: string): string {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(objectName);
    return data.publicUrl;
  }

  getStorageBaseUrl(): string {
    return `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}`;
  }
}
