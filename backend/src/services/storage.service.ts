import { minioClient } from '../config/minio';
import { config } from '../config';
import { Readable } from 'stream';

export class StorageService {
  private bucket = config.minio.bucket;

  private sanitizeObjectName(name: string): string {
    if (name.includes('..') || name.startsWith('/') || /[\x00-\x1f]/.test(name)) {
      throw new Error('Invalid object name');
    }
    return name;
  }

  async delete(objectName: string): Promise<void> {
    await minioClient.removeObject(this.bucket, this.sanitizeObjectName(objectName));
  }

  async upload(objectName: string, buffer: Buffer, contentType: string): Promise<string> {
    objectName = this.sanitizeObjectName(objectName);
    await minioClient.putObject(this.bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return objectName;
  }

  async uploadStream(objectName: string, stream: Readable, size: number, contentType: string): Promise<string> {
    objectName = this.sanitizeObjectName(objectName);
    await minioClient.putObject(this.bucket, objectName, stream, size, {
      'Content-Type': contentType,
    });
    return objectName;
  }

  async getPresignedDownloadUrl(objectName: string, expiry = 3600): Promise<string> {
    return minioClient.presignedGetObject(this.bucket, objectName, expiry);
  }

  async getPresignedUploadUrl(objectName: string, expiry = 3600): Promise<string> {
    return minioClient.presignedPutObject(this.bucket, objectName, expiry);
  }

  async getObject(objectName: string): Promise<Readable> {
    return minioClient.getObject(this.bucket, objectName);
  }

  async getObjectAsBuffer(objectName: string): Promise<Buffer> {
    const stream = await this.getObject(objectName);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteObject(objectName: string): Promise<void> {
    await minioClient.removeObject(this.bucket, objectName);
  }

  async objectExists(objectName: string): Promise<boolean> {
    try {
      await minioClient.statObject(this.bucket, objectName);
      return true;
    } catch {
      return false;
    }
  }
}
