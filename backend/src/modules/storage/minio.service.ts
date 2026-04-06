import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'studydocs');
    
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.configService.get<string>('MINIO_PORT', '9000')),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin123')
    });

    this.initBucket();
  }

  private async initBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
      }
      
      // Make bucket public for preview assets by setting policy
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`]
          }
        ]
      };
      await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
    } catch (error) {
      console.error('Lỗi khi khởi tạo bucket MinIO', error);
    }
  }

  async uploadFile(objectName: string, buffer: Buffer, mimetype: string) {
    try {
      await this.minioClient.putObject(this.bucketName, objectName, buffer, buffer.length, {
        'Content-Type': mimetype
      });
      return objectName;
    } catch (e) {
      throw new InternalServerErrorException('Lỗi upload file lên MinIO');
    }
  }

  async getPresignedUrl(objectName: string, expiryInSeconds = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(this.bucketName, objectName, expiryInSeconds);
    } catch (err) {
      throw new InternalServerErrorException('Không lấy được URL tải về từ MinIO');
    }
  }

  async generateUploadPresignedUrl(objectName: string, expiryInSeconds = 3600): Promise<string> {
    try {
      return await this.minioClient.presignedPutObject(this.bucketName, objectName, expiryInSeconds);
    } catch (err) {
      throw new InternalServerErrorException('Lỗi tạo URL upload file trung gian');
    }
  }
}
