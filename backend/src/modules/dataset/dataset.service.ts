import fs from 'fs';
import prisma from '../../config/database';
import { AppError } from '../../utils/apiResponse';
import { StorageService } from '../../services/storage.service';
import { sanitizeFilename, stripHtmlTags } from '../../utils/fileHelpers';

const storage = new StorageService();

export class DatasetService {
  // AUDIT-FIX: Sanitize filename + stream upload from disk (no memory buffer)
  async upload(competitionId: string, userId: string, file: Express.Multer.File, rawTitle: string, rawDescription?: string, isPublic = false) {
    const title = stripHtmlTags(rawTitle);
    const description = rawDescription ? stripHtmlTags(rawDescription) : undefined;
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition) throw new AppError('Không tìm thấy cuộc thi', 404);
    if (competition.hostId !== userId) {
      throw new AppError('Chỉ đơn vị tổ chức mới có thể tải bộ dữ liệu lên', 403);
    }

    const safeName = sanitizeFilename(file.originalname);

    return prisma.$transaction(async (tx) => {
      const latestVersion = await tx.dataset.findFirst({
        where: { competitionId },
        orderBy: { version: 'desc' },
      });
      const version = (latestVersion?.version || 0) + 1;
      const objectName = `datasets/${competitionId}/v${version}/${safeName}`;

      try {
        const stream = fs.createReadStream(file.path);
        await storage.uploadStream(objectName, stream, file.size, file.mimetype);
      } finally {
        fs.unlink(file.path, () => {});
      }

      return tx.dataset.create({
        data: {
          competitionId,
          version,
          title,
          description,
          fileUrl: objectName,
          fileName: file.originalname,
          fileSize: BigInt(file.size),
          isPublic,
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async list(competitionId: string, page = 1, limit = 50) {
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const [data, total] = await Promise.all([
      prisma.dataset.findMany({
        where: { competitionId },
        orderBy: { version: 'desc' },
        skip: (page - 1) * cappedLimit,
        take: cappedLimit,
        select: {
          id: true,
          version: true,
          title: true,
          description: true,
          fileName: true,
          fileSize: true,
          isPublic: true,
          downloadCount: true,
          createdAt: true,
        },
      }),
      prisma.dataset.count({ where: { competitionId } }),
    ]);

    return {
      data,
      pagination: { page, limit: cappedLimit, total, totalPages: Math.ceil(total / cappedLimit) },
    };
  }

  async getDownloadUrl(datasetId: string, userId: string) {
    const dataset = await prisma.dataset.findUnique({
      where: { id: datasetId },
      include: { competition: true },
    });

    if (!dataset) throw new AppError('Không tìm thấy bộ dữ liệu', 404);

    if (!dataset.isPublic) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_competitionId: { userId, competitionId: dataset.competitionId },
        },
      });
      if (!enrollment) throw new AppError('Bạn phải tham gia cuộc thi để tải dữ liệu', 403);
    }

    await prisma.dataset.update({
      where: { id: datasetId },
      data: { downloadCount: { increment: 1 } },
    });

    const url = await storage.getPresignedDownloadUrl(dataset.fileUrl);
    return { url, fileName: dataset.fileName };
  }

  // AUDIT-FIX: Stream-based preview — only read first N lines, not entire file
  async preview(datasetId: string, userId: string, maxRows = 100) {
    const dataset = await prisma.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) throw new AppError('Không tìm thấy bộ dữ liệu', 404);

    if (!dataset.isPublic) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_competitionId: { userId, competitionId: dataset.competitionId } },
      });
      if (!enrollment) throw new AppError('Bạn phải tham gia cuộc thi để xem trước dữ liệu', 403);
    }

    const stream = await storage.getObject(dataset.fileUrl);
    const lines: string[] = [];
    let partial = '';
    const targetLines = maxRows + 2;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        partial += chunk.toString('utf-8');
        const parts = partial.split('\n');
        partial = parts.pop() || '';
        for (const line of parts) {
          if (line.trim()) lines.push(line);
          if (lines.length >= targetLines) {
            stream.destroy();
            return resolve();
          }
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    const headers = lines[0]?.split(',').map((h) => h.trim()) || [];
    const rows = lines.slice(1, maxRows + 1).map((line) =>
      line.split(',').map((cell) => cell.trim())
    );

    const stats = {
      previewRows: rows.length,
      totalColumns: headers.length,
      columns: headers.map((header, idx) => {
        const values = rows.map((row) => row[idx]).filter(Boolean);
        const numericValues = values.map(Number).filter((n) => !isNaN(n));
        return {
          name: header,
          type: numericValues.length === values.length ? 'numeric' : 'string',
          nonNull: values.length,
          unique: new Set(values).size,
        };
      }),
    };

    return { headers, rows, stats };
  }
}
