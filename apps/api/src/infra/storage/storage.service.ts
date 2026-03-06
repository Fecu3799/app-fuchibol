import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_BUCKET');
    this.publicBaseUrl = config.getOrThrow<string>('STORAGE_PUBLIC_BASE_URL');

    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    const forcePathStyle =
      config.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true';

    this.s3 = new S3Client({
      region: config.get<string>('STORAGE_REGION', 'us-east-1'),
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_SECRET_ACCESS_KEY'),
      },
    });
  }

  async createPresignedPutUrl({
    key,
    contentType,
    expiresInSec,
  }: {
    key: string;
    contentType: string;
    expiresInSec: number;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSec });
  }

  buildPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
