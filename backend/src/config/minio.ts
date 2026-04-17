import * as Minio from 'minio';
import { config } from './index';
import { logger } from '../utils/logger';

export const minioClient = new Minio.Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
});

export async function ensureBucket(retries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const exists = await minioClient.bucketExists(config.minio.bucket);
      if (!exists) {
        await minioClient.makeBucket(config.minio.bucket);
        logger.info({ bucket: config.minio.bucket }, 'MinIO bucket created');
      }
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      logger.warn({ attempt, retries, err: (err as Error).message }, 'MinIO not ready, retrying...');
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
}
