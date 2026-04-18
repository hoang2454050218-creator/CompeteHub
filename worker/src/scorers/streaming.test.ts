import {
  AccuracyScorer,
  RmseScorer,
  LogLossScorer,
  F1ScoreScorer,
  AucRocScorer,
  createStreamingScorer,
} from './streaming';
import { accuracy, rmse, logLoss, f1Score, aucRoc } from './index';

function fillFromArrays(scorer: { update: (a: number, p: number) => void; finalize: () => number }, actual: number[], predicted: number[]) {
  for (let i = 0; i < actual.length; i++) scorer.update(actual[i], predicted[i]);
  return scorer.finalize();
}

const PRECISION = 1e-9;

describe('Streaming scorers parity with batch (exact)', () => {
  const actualBin = [1, 0, 1, 1, 0, 0, 1, 0];
  const predictedBin = [1, 0, 0, 1, 0, 1, 1, 0];
  const actualReg = [1.5, 2.0, 3.5, 4.0, 5.5];
  const predictedReg = [1.4, 2.1, 3.7, 3.9, 5.0];
  const actualProb = [1, 0, 1, 1, 0, 0, 1, 0];
  const predictedProb = [0.9, 0.1, 0.8, 0.95, 0.2, 0.3, 0.7, 0.05];

  it('ACCURACY matches batch exactly', () => {
    const a = fillFromArrays(new AccuracyScorer(), actualBin, predictedBin);
    expect(Math.abs(a - accuracy(actualBin, predictedBin))).toBeLessThan(PRECISION);
  });

  it('RMSE matches batch exactly', () => {
    const a = fillFromArrays(new RmseScorer(), actualReg, predictedReg);
    expect(Math.abs(a - rmse(actualReg, predictedReg))).toBeLessThan(PRECISION);
  });

  it('LOG_LOSS matches batch exactly', () => {
    const a = fillFromArrays(new LogLossScorer(), actualProb, predictedProb);
    expect(Math.abs(a - logLoss(actualProb, predictedProb))).toBeLessThan(PRECISION);
  });

  it('F1_SCORE binary matches batch exactly', () => {
    const a = fillFromArrays(new F1ScoreScorer(), actualBin, predictedBin);
    expect(Math.abs(a - f1Score(actualBin, predictedBin))).toBeLessThan(PRECISION);
  });

  it('F1_SCORE multiclass matches batch exactly', () => {
    const actualMc = [0, 1, 2, 0, 1, 2, 0, 1];
    const predictedMc = [0, 2, 1, 0, 1, 2, 1, 1];
    const a = fillFromArrays(new F1ScoreScorer(), actualMc, predictedMc);
    expect(Math.abs(a - f1Score(actualMc, predictedMc))).toBeLessThan(PRECISION);
  });

  it('AUC_ROC matches batch exactly', () => {
    const a = fillFromArrays(new AucRocScorer(), actualProb, predictedProb);
    expect(Math.abs(a - aucRoc(actualProb, predictedProb))).toBeLessThan(PRECISION);
  });
});

describe('Streaming scorers edge cases', () => {
  it('empty data partition throws', () => {
    expect(() => new AccuracyScorer().finalize()).toThrow();
    expect(() => new RmseScorer().finalize()).toThrow();
    expect(() => new LogLossScorer().finalize()).toThrow();
    expect(() => new F1ScoreScorer().finalize()).toThrow();
    expect(() => new AucRocScorer().finalize()).toThrow();
  });

  it('AUC_ROC returns 0.5 for all-positive or all-negative actual', () => {
    const s = new AucRocScorer();
    s.update(1, 0.3); s.update(1, 0.7);
    expect(s.finalize()).toBe(0.5);
  });
});

describe('createStreamingScorer factory', () => {
  it('returns proper instance per metric code', () => {
    expect(createStreamingScorer('ACCURACY')).toBeInstanceOf(AccuracyScorer);
    expect(createStreamingScorer('RMSE')).toBeInstanceOf(RmseScorer);
    expect(createStreamingScorer('LOG_LOSS')).toBeInstanceOf(LogLossScorer);
    expect(createStreamingScorer('F1_SCORE')).toBeInstanceOf(F1ScoreScorer);
    expect(createStreamingScorer('AUC_ROC')).toBeInstanceOf(AucRocScorer);
  });

  it('CUSTOM throws on instantiation (host must provide script)', () => {
    expect(() => createStreamingScorer('CUSTOM')).toThrow();
  });
});
