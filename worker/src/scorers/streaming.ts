/**
 * Streaming (single-pass) scorers. Each scorer maintains running state so the
 * caller can feed rows one at a time and compute the final score in O(1) extra
 * memory beyond what the algorithm strictly needs.
 *
 * - ACCURACY / RMSE / LOG_LOSS: O(1) state, exact 1-pass.
 * - F1_SCORE: O(C) state where C = number of classes seen so far. Macro-averaged.
 * - AUC_ROC: cannot be computed in a single pass without storing scores.
 *   Falls back to BatchScorer (kept in scorers/index.ts).
 */

export interface StreamingScorer {
  update(actual: number, predicted: number): void;
  finalize(): number;
  count: number;
}

export class AccuracyScorer implements StreamingScorer {
  count = 0;
  private correct = 0;
  update(actual: number, predicted: number) {
    this.count++;
    if (actual === predicted) this.correct++;
  }
  finalize(): number {
    if (this.count === 0) throw new Error('Cannot compute score on empty data partition');
    return this.correct / this.count;
  }
}

export class RmseScorer implements StreamingScorer {
  count = 0;
  private sumSq = 0;
  update(actual: number, predicted: number) {
    this.count++;
    const diff = actual - predicted;
    this.sumSq += diff * diff;
  }
  finalize(): number {
    if (this.count === 0) throw new Error('Cannot compute score on empty data partition');
    return Math.sqrt(this.sumSq / this.count);
  }
}

export class LogLossScorer implements StreamingScorer {
  count = 0;
  private sum = 0;
  private static readonly EPSILON = 1e-15;
  update(actual: number, predicted: number) {
    this.count++;
    const p = Math.max(LogLossScorer.EPSILON, Math.min(1 - LogLossScorer.EPSILON, predicted));
    this.sum += actual * Math.log(p) + (1 - actual) * Math.log(1 - p);
  }
  finalize(): number {
    if (this.count === 0) throw new Error('Cannot compute score on empty data partition');
    return -this.sum / this.count;
  }
}

interface ConfusionRow {
  tp: number;
  fp: number;
  fn: number;
}

export class F1ScoreScorer implements StreamingScorer {
  count = 0;
  private confusion = new Map<number, ConfusionRow>();
  private classes = new Set<number>();

  private ensure(cls: number): ConfusionRow {
    let row = this.confusion.get(cls);
    if (!row) {
      row = { tp: 0, fp: 0, fn: 0 };
      this.confusion.set(cls, row);
    }
    this.classes.add(cls);
    return row;
  }

  update(actual: number, predicted: number) {
    this.count++;
    this.ensure(actual);
    const predRow = this.ensure(predicted);
    if (actual === predicted) {
      predRow.tp++;
    } else {
      predRow.fp++;
      this.ensure(actual).fn++;
    }
  }

  finalize(): number {
    if (this.count === 0) throw new Error('Cannot compute score on empty data partition');
    const classes = Array.from(this.classes);
    if (classes.length === 0) return 0;

    if (classes.length === 2) {
      const positiveClass = classes[1] ?? 1;
      return this.f1ForClass(positiveClass);
    }

    let total = 0;
    for (const cls of classes) total += this.f1ForClass(cls);
    return total / classes.length;
  }

  private f1ForClass(cls: number): number {
    const row = this.confusion.get(cls) ?? { tp: 0, fp: 0, fn: 0 };
    const precision = row.tp + row.fp > 0 ? row.tp / (row.tp + row.fp) : 0;
    const recall = row.tp + row.fn > 0 ? row.tp / (row.tp + row.fn) : 0;
    if (precision + recall === 0) return 0;
    return 2 * (precision * recall) / (precision + recall);
  }
}

/**
 * AUC_ROC needs all (actual, predicted) pairs available for sorting, so it
 * cannot be computed truly in 1 pass. We collect predicted scores grouped by
 * actual class so the caller can defer the sort to finalize() — uses much less
 * memory than the previous "build array of objects, then sort by predicted".
 */
export class AucRocScorer implements StreamingScorer {
  count = 0;
  private positives: number[] = [];
  private negatives: number[] = [];

  update(actual: number, predicted: number) {
    this.count++;
    if (actual === 1) this.positives.push(predicted);
    else this.negatives.push(predicted);
  }

  finalize(): number {
    if (this.count === 0) throw new Error('Cannot compute score on empty data partition');
    if (this.positives.length === 0 || this.negatives.length === 0) return 0.5;

    const all: { score: number; label: 1 | 0 }[] = [];
    for (const s of this.positives) all.push({ score: s, label: 1 });
    for (const s of this.negatives) all.push({ score: s, label: 0 });
    all.sort((a, b) => b.score - a.score);

    let tp = 0;
    let fp = 0;
    let auc = 0;
    let prevFpr = 0;
    let prevTpr = 0;
    const totalPositive = this.positives.length;
    const totalNegative = this.negatives.length;

    for (const { label } of all) {
      if (label === 1) tp++;
      else fp++;
      const tpr = tp / totalPositive;
      const fpr = fp / totalNegative;
      auc += (fpr - prevFpr) * (tpr + prevTpr) / 2;
      prevFpr = fpr;
      prevTpr = tpr;
    }
    return auc;
  }
}

export type EvalMetricCode = 'ACCURACY' | 'RMSE' | 'F1_SCORE' | 'AUC_ROC' | 'LOG_LOSS' | 'CUSTOM';

export function createStreamingScorer(metric: EvalMetricCode): StreamingScorer {
  switch (metric) {
    case 'ACCURACY': return new AccuracyScorer();
    case 'RMSE': return new RmseScorer();
    case 'F1_SCORE': return new F1ScoreScorer();
    case 'AUC_ROC': return new AucRocScorer();
    case 'LOG_LOSS': return new LogLossScorer();
    case 'CUSTOM':
      throw new Error('CUSTOM metric requires a scoring script configured by the competition host. Please contact the host.');
    default:
      throw new Error(`Unknown metric: ${metric}`);
  }
}
