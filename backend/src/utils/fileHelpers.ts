import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import sanitize from 'sanitize-html';

export function sanitizeFilename(original: string): string {
  const base = path.basename(original);
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${uuid()}_${clean}`;
}

const CSV_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CSV_PRINTABLE = /^[\x09\x0a\x0d\x20-\x7e]/;

// AUDIT-FIX H-02: Reject known binary magic bytes outright instead of relying on
// "first byte printable + comma somewhere" heuristic which was bypassable by any
// binary that begins with a printable byte and contains commas anywhere.
const BINARY_SIGNATURES: Buffer[] = [
  Buffer.from([0x4d, 0x5a]),                    // PE/EXE/DLL "MZ"
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),        // ZIP/JAR/DOCX "PK\x03\x04"
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),        // ZIP empty
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),        // ZIP spanned
  Buffer.from([0x1f, 0x8b]),                    // gzip
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]),        // ELF
  Buffer.from([0xfe, 0xed, 0xfa, 0xce]),        // Mach-O 32
  Buffer.from([0xfe, 0xed, 0xfa, 0xcf]),        // Mach-O 64
  Buffer.from([0xca, 0xfe, 0xba, 0xbe]),        // Java class / Mach-O FAT
  Buffer.from([0x25, 0x50, 0x44, 0x46]),        // PDF "%PDF"
  Buffer.from([0xff, 0xd8, 0xff]),              // JPEG
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),        // PNG
  Buffer.from([0x47, 0x49, 0x46, 0x38]),        // GIF8
  Buffer.from([0x42, 0x4d]),                    // BMP "BM"
  Buffer.from('PAR1'),                          // Parquet
  Buffer.from('SQLite format 3'),               // SQLite
];

export function validateCsvMagicBytes(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
    if (bytesRead === 0) return false;

    for (const sig of BINARY_SIGNATURES) {
      if (bytesRead >= sig.length && buf.subarray(0, sig.length).equals(sig)) {
        return false;
      }
    }

    let start = 0;
    if (buf[0] === CSV_BOM[0] && buf[1] === CSV_BOM[1] && buf[2] === CSV_BOM[2]) {
      start = 3;
    }

    for (let i = start; i < bytesRead; i++) {
      if (buf[i] === 0x00) return false;
    }

    const sample = buf.subarray(start, bytesRead).toString('utf-8');
    if (!CSV_PRINTABLE.test(sample)) return false;

    const firstLineEnd = sample.search(/[\r\n]/);
    const firstLine = firstLineEnd === -1 ? sample : sample.slice(0, firstLineEnd);
    if (!firstLine) return false;

    const delimiters = [',', '\t', ';'];
    const hasDelimiter = delimiters.some((d) => firstLine.includes(d));
    if (!hasDelimiter) return false;

    return true;
  } finally {
    fs.closeSync(fd);
  }
}

const MAGIC_BYTES: Record<string, Buffer[]> = {
  zip: [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06])],
  gzip: [Buffer.from([0x1f, 0x8b])],
  parquet: [Buffer.from('PAR1')],
  xlsx: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
};

export function validateDatasetMagicBytes(filePath: string, extension: string): boolean {
  const ext = extension.toLowerCase().replace('.', '');

  if (['csv', 'tsv', 'txt', 'json'].includes(ext)) {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(64);
      const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
      if (bytesRead === 0) return false;
      let start = 0;
      if (buf[0] === CSV_BOM[0] && buf[1] === CSV_BOM[1] && buf[2] === CSV_BOM[2]) start = 3;
      const ch = buf[start];
      return (ch >= 0x09 && ch <= 0x0d) || (ch >= 0x20 && ch <= 0x7e);
    } finally {
      fs.closeSync(fd);
    }
  }

  const expected = MAGIC_BYTES[ext];
  if (!expected) return true;

  const fd = fs.openSync(filePath, 'r');
  try {
    const maxLen = Math.max(...expected.map((b) => b.length));
    const buf = Buffer.alloc(maxLen);
    fs.readSync(fd, buf, 0, maxLen, 0);
    return expected.some((sig) => buf.subarray(0, sig.length).equals(sig));
  } finally {
    fs.closeSync(fd);
  }
}

export function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function stripHtmlTags(input: string): string {
  return sanitize(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  });
}
