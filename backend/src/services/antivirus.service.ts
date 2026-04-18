import NodeClam from 'clamscan';
import { logger } from '../utils/logger';

export type ScanResult = { clean: true } | { clean: false; virus: string };

const CLAMAV_HOST = process.env.CLAMAV_HOST;
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310', 10);
const ANTIVIRUS_REQUIRED = process.env.ANTIVIRUS_REQUIRED === 'true';
const SCAN_DISABLED_ENVS = new Set(['test']);

let clamPromise: Promise<NodeClam> | null = null;

async function getClamScan(): Promise<NodeClam | null> {
  if (!CLAMAV_HOST) return null;
  if (SCAN_DISABLED_ENVS.has(process.env.NODE_ENV || '')) return null;
  if (!clamPromise) {
    clamPromise = new NodeClam().init({
      removeInfected: false,
      clamdscan: {
        host: CLAMAV_HOST,
        port: CLAMAV_PORT,
        timeout: 60_000,
      },
    });
  }
  try {
    return await clamPromise;
  } catch (err) {
    logger.error({ err }, 'ClamAV initialisation failed');
    clamPromise = null;
    return null;
  }
}

export async function scanFile(filePath: string): Promise<ScanResult> {
  const clam = await getClamScan();
  if (!clam) {
    if (ANTIVIRUS_REQUIRED) {
      throw new Error('Antivirus scan unavailable but ANTIVIRUS_REQUIRED=true');
    }
    return { clean: true };
  }
  try {
    const result = await clam.isInfected(filePath);
    if (result.isInfected) {
      const virus = result.viruses?.[0] ?? 'unknown';
      logger.warn({ filePath, virus }, 'Antivirus flagged infected file');
      return { clean: false, virus };
    }
    return { clean: true };
  } catch (err) {
    logger.error({ err, filePath }, 'Antivirus scan failed');
    if (ANTIVIRUS_REQUIRED) throw err;
    return { clean: true };
  }
}
