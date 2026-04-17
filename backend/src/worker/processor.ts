import { parse } from 'csv-parse';
import prisma from '../config/database';
import { redis } from '../config/redis';
import { minioClient } from '../config/minio';
import { config } from '../config';
import { SCORERS, HIGHER_IS_BETTER } from './scorers';

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_CSV_ROWS = 5_000_000;

const bucket = config.minio.bucket;

async function parseCsvStream(objectName: string): Promise<Record<string, string>[]> {
  const stat = await minioClient.statObject(bucket, objectName);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`Tệp vượt quá kích thước cho phép: ${stat.size} byte (tối đa ${MAX_FILE_SIZE})`);
  }

  const stream = await minioClient.getObject(bucket, objectName);
  const records: Record<string, string>[] = [];

  return new Promise((resolve, reject) => {
    const parser = stream.pipe(parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }));

    parser.on('data', (record: Record<string, string>) => {
      if (records.length >= MAX_CSV_ROWS) {
        parser.destroy(new Error(`Tệp CSV vượt quá giới hạn tối đa ${MAX_CSV_ROWS} dòng`));
        return;
      }
      records.push(record);
    });
    parser.on('end', () => resolve(records));
    parser.on('error', reject);
  });
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function splitData(data: Record<string, string>[], splitRatio: number, seed: number): {
  publicIndices: Set<number>;
  privateIndices: Set<number>;
} {
  const publicCount = Math.floor(data.length * splitRatio);
  const indices = data.map((_, i) => i);

  const rng = seededRandom(seed);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const publicIndices = new Set(indices.slice(0, publicCount));
  const privateIndices = new Set(indices.slice(publicCount));

  return { publicIndices, privateIndices };
}

export interface ScoringJob {
  submissionId: string;
  competitionId: string;
  userId: string;
  teamId: string | null;
}

function detectIdColumn(headers: string[]): string | undefined {
  return headers.find((k) => /^id$/i.test(k));
}

function detectTargetColumn(headers: string[]): string {
  const col = headers.find((k) => !/^id$/i.test(k));
  if (!col) throw new Error('Không thể xác định cột mục tiêu từ dữ liệu đáp án');
  return col;
}

export async function processScoring(job: ScoringJob) {
  const { submissionId, competitionId, userId, teamId } = job;

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'SCORING' },
  });

  try {
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition || !competition.groundTruthUrl) {
      throw new Error('Không tìm thấy cuộc thi hoặc dữ liệu đáp án');
    }

    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new Error('Không tìm thấy bài nộp');

    const [submissionData, truthData] = await Promise.all([
      parseCsvStream(submission.fileUrl),
      parseCsvStream(competition.groundTruthUrl),
    ]);

    if (truthData.length === 0) throw new Error('Tệp đáp án đang trống');
    if (submissionData.length === 0) throw new Error('Tệp bài nộp đang trống');

    if (submissionData.length !== truthData.length) {
      throw new Error(`Số dòng không khớp: cần ${truthData.length}, nhận được ${submissionData.length}`);
    }

    const truthHeaders = Object.keys(truthData[0]);
    const submissionHeaders = Object.keys(submissionData[0]);
    const missingColumns = truthHeaders.filter((c) => !submissionHeaders.includes(c));
    if (missingColumns.length > 0) {
      throw new Error(`Bài nộp đang thiếu các cột: ${missingColumns.join(', ')}`);
    }

    const targetColumn = detectTargetColumn(truthHeaders);
    const idColumn = detectIdColumn(truthHeaders);

    let actualValues: number[];
    let predictedValues: number[];

    if (idColumn) {
      const truthMap = new Map(truthData.map((row) => [row[idColumn], row]));
      actualValues = [];
      predictedValues = [];
      for (const subRow of submissionData) {
        const key = subRow[idColumn];
        const truthRow = truthMap.get(key);
        if (!truthRow) throw new Error(`ID không hợp lệ trong bài nộp: ${key}`);
        actualValues.push(parseFloat(truthRow[targetColumn]));
        predictedValues.push(parseFloat(subRow[targetColumn]));
      }
    } else {
      actualValues = truthData.map((row) => parseFloat(row[targetColumn]));
      predictedValues = submissionData.map((row) => parseFloat(row[targetColumn]));
    }

    const isInvalidNumber = (v: number) => !Number.isFinite(v);
    if (actualValues.some(isInvalidNumber)) {
      throw new Error('Dữ liệu đáp án chứa giá trị không phải số, Infinity hoặc NaN');
    }
    if (predictedValues.some(isInvalidNumber)) {
      throw new Error('Bài nộp chứa giá trị không phải số, Infinity hoặc NaN trong cột mục tiêu');
    }

    const scorer = SCORERS[competition.evalMetric];
    if (!scorer) throw new Error(`Chưa hỗ trợ chỉ số đánh giá: ${competition.evalMetric}`);

    const competitionSeed = hashCode(competitionId);
    const { publicIndices, privateIndices } = splitData(truthData, competition.pubPrivSplit, competitionSeed);

    const publicActual = actualValues.filter((_, i) => publicIndices.has(i));
    const publicPredicted = predictedValues.filter((_, i) => publicIndices.has(i));
    const privateActual = actualValues.filter((_, i) => privateIndices.has(i));
    const privatePredicted = predictedValues.filter((_, i) => privateIndices.has(i));

    if (publicActual.length === 0 || privateActual.length === 0) {
      throw new Error('Tỷ lệ chia công khai/riêng tư tạo ra một nhóm rỗng. Vui lòng kiểm tra pubPrivSplit');
    }

    const publicScore = scorer(publicActual, publicPredicted);
    const privateScore = scorer(privateActual, privatePredicted);

    if (!Number.isFinite(publicScore) || !Number.isFinite(privateScore)) {
      throw new Error('Kết quả chấm điểm không hợp lệ');
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: 'SCORED',
        publicScore,
        privateScore,
        scoredAt: new Date(),
      },
    });

    const higherIsBetter = HIGHER_IS_BETTER[competition.evalMetric] ?? true;
    await upsertLeaderboardEntry(competitionId, userId, teamId, publicScore, privateScore, higherIsBetter);

    await prisma.notification.create({
      data: {
        userId,
        type: 'SUBMISSION_SCORED',
        title: 'Bài nộp đã được chấm điểm',
        message: `Bài nộp của bạn đạt ${publicScore.toFixed(5)} điểm công khai`,
        refType: 'submission',
        refId: submissionId,
      },
    });

    await redis.publish('scoring:complete', JSON.stringify({
      competitionId,
      userId,
      submissionId,
      publicScore,
    }));

    return { publicScore, privateScore };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi chấm điểm không xác định';
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'FAILED', errorMessage: message },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'SUBMISSION_SCORED',
        title: 'Bài nộp chấm điểm thất bại',
        message: `Chấm điểm thất bại: ${message}`,
        refType: 'submission',
        refId: submissionId,
      },
    });

    throw error;
  }
}

async function upsertLeaderboardEntry(
  competitionId: string,
  userId: string,
  teamId: string | null,
  publicScore: number,
  privateScore: number,
  higherIsBetter: boolean
) {
  const compareBest = (existing: number | null, incoming: number) => {
    if (existing === null) return incoming;
    return higherIsBetter
      ? Math.max(existing, incoming)
      : Math.min(existing, incoming);
  };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.leaderboardEntry.findUnique({
      where: { competitionId_userId: { competitionId, userId } },
    });

    const bestPublic = compareBest(existing?.bestPublicScore ?? null, publicScore);
    const bestPrivate = compareBest(existing?.bestPrivateScore ?? null, privateScore);

    await tx.leaderboardEntry.upsert({
      where: { competitionId_userId: { competitionId, userId } },
      update: {
        bestPublicScore: bestPublic,
        bestPrivateScore: bestPrivate,
        teamId,
        submissionCount: { increment: 1 },
        lastSubmittedAt: new Date(),
      },
      create: {
        competitionId,
        userId,
        teamId,
        bestPublicScore: bestPublic,
        bestPrivateScore: bestPrivate,
        submissionCount: 1,
        lastSubmittedAt: new Date(),
      },
    });
  }, { isolationLevel: 'Serializable' });

  const sortPublic = higherIsBetter ? publicScore : -publicScore;
  const sortPrivate = higherIsBetter ? privateScore : -privateScore;
  await redis.zadd(`leaderboard:${competitionId}:public`, sortPublic, userId);
  await redis.zadd(`leaderboard:${competitionId}:private`, sortPrivate, userId);
}
