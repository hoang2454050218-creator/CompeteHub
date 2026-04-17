export type ScorerFn = (actual: number[], predicted: number[]) => number;

function assertNonEmpty(actual: number[], predicted: number[]) {
  if (actual.length === 0 || predicted.length === 0) {
    throw new Error('Không thể tính điểm trên tập dữ liệu rỗng');
  }
}

export function accuracy(actual: number[], predicted: number[]): number {
  assertNonEmpty(actual, predicted);
  let correct = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === predicted[i]) correct++;
  }
  return correct / actual.length;
}

export function rmse(actual: number[], predicted: number[]): number {
  assertNonEmpty(actual, predicted);
  let sumSq = 0;
  for (let i = 0; i < actual.length; i++) {
    const diff = actual[i] - predicted[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / actual.length);
}

export function f1Score(actual: number[], predicted: number[]): number {
  assertNonEmpty(actual, predicted);
  const classes = [...new Set([...actual, ...predicted])];

  if (classes.length === 2) {
    return binaryF1(actual, predicted, classes[1] ?? 1);
  }

  let totalF1 = 0;
  for (const cls of classes) {
    totalF1 += binaryF1(actual, predicted, cls);
  }
  return totalF1 / classes.length;
}

function binaryF1(actual: number[], predicted: number[], positiveClass: number): number {
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < actual.length; i++) {
    if (predicted[i] === positiveClass && actual[i] === positiveClass) tp++;
    if (predicted[i] === positiveClass && actual[i] !== positiveClass) fp++;
    if (predicted[i] !== positiveClass && actual[i] === positiveClass) fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

  if (precision + recall === 0) return 0;
  return 2 * (precision * recall) / (precision + recall);
}

export function aucRoc(actual: number[], predicted: number[]): number {
  assertNonEmpty(actual, predicted);
  const pairs = actual.map((a, i) => ({ actual: a, predicted: predicted[i] }));
  pairs.sort((a, b) => b.predicted - a.predicted);

  let tp = 0, fp = 0;
  const totalPositive = actual.filter((a) => a === 1).length;
  const totalNegative = actual.length - totalPositive;

  if (totalPositive === 0 || totalNegative === 0) return 0.5;

  let auc = 0;
  let prevFpr = 0;
  let prevTpr = 0;

  for (const pair of pairs) {
    if (pair.actual === 1) {
      tp++;
    } else {
      fp++;
    }

    const tpr = tp / totalPositive;
    const fpr = fp / totalNegative;

    auc += (fpr - prevFpr) * (tpr + prevTpr) / 2;
    prevFpr = fpr;
    prevTpr = tpr;
  }

  return auc;
}

export function logLoss(actual: number[], predicted: number[]): number {
  assertNonEmpty(actual, predicted);
  const epsilon = 1e-15;
  let sum = 0;

  for (let i = 0; i < actual.length; i++) {
    const p = Math.max(epsilon, Math.min(1 - epsilon, predicted[i]));
    sum += actual[i] * Math.log(p) + (1 - actual[i]) * Math.log(1 - p);
  }

  return -sum / actual.length;
}

export const SCORERS: Record<string, ScorerFn> = {
  ACCURACY: accuracy,
  RMSE: rmse,
  F1_SCORE: f1Score,
  AUC_ROC: aucRoc,
  LOG_LOSS: logLoss,
  CUSTOM: () => {
    throw new Error('Chỉ số CUSTOM yêu cầu kịch bản chấm điểm do đơn vị tổ chức cấu hình. Vui lòng liên hệ đơn vị tổ chức.');
  },
};

export const HIGHER_IS_BETTER: Record<string, boolean> = {
  ACCURACY: true,
  RMSE: false,
  F1_SCORE: true,
  AUC_ROC: true,
  LOG_LOSS: false,
};
