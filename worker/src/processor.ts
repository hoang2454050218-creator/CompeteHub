import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse';
import * as Minio from 'minio';
import Redis from 'ioredis';
import { HIGHER_IS_BETTER } from './scorers';
import { createStreamingScorer, EvalMetricCode, StreamingScorer } from './scorers/streaming';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});

const minio = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  region: process.env.MINIO_REGION || 'us-east-1',
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const bucket = process.env.MINIO_BUCKET || 'competition-platform';

const MAX_FILE_SIZE = parseInt(process.env.MAX_SCORING_FILE_SIZE || String(500 * 1024 * 1024), 10);
const MAX_CSV_ROWS = parseInt(process.env.MAX_CSV_ROWS || '5000000', 10);

async function* streamCsvRows(objectName: string): AsyncGenerator<Record<string, string>, void, unknown> {
  const stat = await minio.statObject(bucket, objectName);
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stat.size} bytes (max ${MAX_FILE_SIZE})`);
  }
  const stream = await minio.getObject(bucket, objectName);
  const parser = stream.pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));
  let count = 0;
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    count++;
    if (count > MAX_CSV_ROWS) {
      throw new Error(`CSV exceeds maximum row limit of ${MAX_CSV_ROWS}`);
    }
    yield record;
  }
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

/**
 * Deterministic public/private split — returns a Uint8Array where index i is 1
 * if row i belongs to public partition, 0 otherwise. Same seed → same split.
 */
function buildSplitMask(rowCount: number, splitRatio: number, seed: number): Uint8Array {
  const indices = new Int32Array(rowCount);
  for (let i = 0; i < rowCount; i++) indices[i] = i;
  const rng = seededRandom(seed);
  for (let i = rowCount - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
  }
  const publicCount = Math.floor(rowCount * splitRatio);
  const mask = new Uint8Array(rowCount);
  for (let i = 0; i < publicCount; i++) mask[indices[i]] = 1;
  return mask;
}

export interface ScoringJob {
  submissionId: string;
  competitionId: string;
  userId: string;
  teamId: string | null;
}

interface ProcessResult {
  publicScore: number;
  privateScore: number;
  metric: string;
  rowCount: number;
}

function detectIdColumn(headers: string[]): string | undefined {
  return headers.find((k) => /^id$/i.test(k));
}

function detectTargetColumn(headers: string[]): string {
  const col = headers.find((k) => !/^id$/i.test(k));
  if (!col) throw new Error('Cannot determine target column from ground truth');
  return col;
}

interface TruthIndex {
  byId: Map<string, number> | null;
  actualValues: Float32Array;
  rowCount: number;
  targetColumn: string;
  idColumn: string | undefined;
}

async function buildTruthIndex(objectName: string): Promise<TruthIndex> {
  let actualValues: Float32Array | null = null;
  let buffer: number[] = [];
  let byId: Map<string, number> | null = null;
  let targetColumn: string | null = null;
  let idColumn: string | undefined;
  let headersResolved = false;

  for await (const row of streamCsvRows(objectName)) {
    if (!headersResolved) {
      const headers = Object.keys(row);
      targetColumn = detectTargetColumn(headers);
      idColumn = detectIdColumn(headers);
      if (idColumn) byId = new Map();
      headersResolved = true;
    }
    const target = parseFloat(row[targetColumn!]);
    if (!Number.isFinite(target)) {
      throw new Error('Ground truth contains non-numeric, Infinity, or NaN values');
    }
    if (idColumn && byId) {
      const key = row[idColumn];
      if (byId.has(key)) throw new Error(`Duplicate ID in ground truth: ${key}`);
      byId.set(key, buffer.length);
    }
    buffer.push(target);
  }

  if (!headersResolved || !targetColumn) throw new Error('Ground truth file is empty');
  actualValues = Float32Array.from(buffer);
  buffer = [];
  return { byId, actualValues, rowCount: actualValues.length, targetColumn, idColumn };
}

export async function processScoring(job: ScoringJob): Promise<ProcessResult> {
  const { submissionId, competitionId, userId, teamId } = job;

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'SCORING' },
  });

  try {
    const competition = await prisma.competition.findUnique({ where: { id: competitionId } });
    if (!competition || !competition.groundTruthUrl) {
      throw new Error('Competition or ground truth not found');
    }

    const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new Error('Submission not found');

    const truth = await buildTruthIndex(competition.groundTruthUrl);
    if (truth.rowCount === 0) throw new Error('Ground truth file is empty');

    const splitMask = buildSplitMask(truth.rowCount, competition.pubPrivSplit, hashCode(competitionId));
    const metric = competition.evalMetric as EvalMetricCode;

    const publicScorer: StreamingScorer = createStreamingScorer(metric);
    const privateScorer: StreamingScorer = createStreamingScorer(metric);

    let processedRows = 0;
    let headersChecked = false;

    for await (const subRow of streamCsvRows(submission.fileUrl)) {
      if (!headersChecked) {
        const submissionHeaders = Object.keys(subRow);
        if (truth.idColumn && !submissionHeaders.includes(truth.idColumn)) {
          throw new Error(`Submission is missing column: ${truth.idColumn}`);
        }
        if (!submissionHeaders.includes(truth.targetColumn)) {
          throw new Error(`Submission is missing column: ${truth.targetColumn}`);
        }
        headersChecked = true;
      }

      let truthIdx: number;
      if (truth.byId && truth.idColumn) {
        const key = subRow[truth.idColumn];
        const found = truth.byId.get(key);
        if (found === undefined) throw new Error(`Unknown ID in submission: ${key}`);
        truthIdx = found;
      } else {
        truthIdx = processedRows;
        if (truthIdx >= truth.rowCount) {
          throw new Error(`Submission has more rows than ground truth (${truth.rowCount})`);
        }
      }

      const predicted = parseFloat(subRow[truth.targetColumn]);
      if (!Number.isFinite(predicted)) {
        throw new Error('Submission contains non-numeric, Infinity, or NaN values in target column');
      }
      const actual = truth.actualValues[truthIdx];

      if (splitMask[truthIdx] === 1) publicScorer.update(actual, predicted);
      else privateScorer.update(actual, predicted);

      processedRows++;
    }

    if (processedRows !== truth.rowCount) {
      throw new Error(`Row count mismatch: expected ${truth.rowCount}, got ${processedRows}`);
    }
    if (publicScorer.count === 0 || privateScorer.count === 0) {
      throw new Error('Public/private split produced an empty partition — check pubPrivSplit ratio');
    }

    const publicScore = publicScorer.finalize();
    const privateScore = privateScorer.finalize();

    if (!Number.isFinite(publicScore) || !Number.isFinite(privateScore)) {
      throw new Error('Scoring produced non-finite result');
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
        title: 'Submission Scored',
        message: `Your submission scored ${publicScore.toFixed(5)} (public)`,
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

    return {
      publicScore,
      privateScore,
      metric: competition.evalMetric,
      rowCount: truth.rowCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scoring error';
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'FAILED', errorMessage: message },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'SUBMISSION_SCORED',
        title: 'Submission Failed',
        message: `Scoring failed: ${message}`,
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
