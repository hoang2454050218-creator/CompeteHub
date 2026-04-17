import { accuracy, rmse, f1Score, aucRoc, logLoss, SCORERS, HIGHER_IS_BETTER } from './index';

describe('accuracy', () => {
  it('returns 1.0 for perfect predictions', () => {
    expect(accuracy([1, 0, 1, 0], [1, 0, 1, 0])).toBe(1.0);
  });

  it('returns 0.0 for all-wrong predictions', () => {
    expect(accuracy([1, 1, 1, 1], [0, 0, 0, 0])).toBe(0.0);
  });

  it('returns correct ratio for mixed predictions', () => {
    expect(accuracy([1, 0, 1, 0, 1], [1, 0, 0, 0, 1])).toBe(0.8);
  });

  it('returns 0.5 for half correct', () => {
    expect(accuracy([1, 0, 1, 0], [0, 1, 1, 0])).toBe(0.5);
  });

  it('handles single element', () => {
    expect(accuracy([1], [1])).toBe(1.0);
    expect(accuracy([1], [0])).toBe(0.0);
  });

  it('handles multiclass labels', () => {
    expect(accuracy([0, 1, 2, 3], [0, 1, 2, 3])).toBe(1.0);
    expect(accuracy([0, 1, 2, 3], [3, 2, 1, 0])).toBe(0.0);
  });
});

describe('rmse', () => {
  it('returns 0 for perfect predictions', () => {
    expect(rmse([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('returns correct RMSE for known values', () => {
    const result = rmse([1, 2, 3, 4], [1.1, 2.2, 2.8, 4.1]);
    expect(result).toBeCloseTo(0.1581, 3);
  });

  it('returns larger RMSE for worse predictions', () => {
    const good = rmse([1, 2, 3], [1.1, 2.1, 3.1]);
    const bad = rmse([1, 2, 3], [2, 3, 4]);
    expect(bad).toBeGreaterThan(good);
  });

  it('handles single element', () => {
    expect(rmse([5], [3])).toBe(2);
  });

  it('handles negative values', () => {
    expect(rmse([-1, -2], [-1, -2])).toBe(0);
  });

  it('is symmetric in error direction', () => {
    expect(rmse([0], [1])).toBeCloseTo(rmse([0], [-1]), 10);
  });
});

describe('f1Score', () => {
  it('returns 1.0 for perfect binary classification', () => {
    expect(f1Score([1, 1, 0, 0], [1, 1, 0, 0])).toBe(1.0);
  });

  it('returns 0 when all predictions are wrong class', () => {
    expect(f1Score([1, 1, 1, 1], [0, 0, 0, 0])).toBe(0);
  });

  it('calculates correct F1 for partial match', () => {
    // classes from Set([0,1,0,1,0,1,1,0]) = [0,1], positiveClass = classes[1] = 1
    // actual=[0,1,0,1], predicted=[0,1,1,0] => TP=1, FP=1, FN=1 => P=0.5, R=0.5 => F1=0.5
    const result = f1Score([0, 1, 0, 1], [0, 1, 1, 0]);
    expect(result).toBeCloseTo(0.5, 3);
  });

  it('handles mixed binary predictions', () => {
    // classes from Set([0,0,1,1,0,0,1,1]) = [0,1], positiveClass = 1
    // actual=[0,0,1,1], predicted=[0,0,1,1] => perfect => F1=1
    expect(f1Score([0, 0, 1, 1], [0, 0, 1, 1])).toBe(1.0);
  });

  it('handles multiclass with macro average', () => {
    const result = f1Score([0, 1, 2, 0, 1, 2], [0, 1, 2, 0, 1, 2]);
    expect(result).toBe(1.0);
  });

  it('handles case where precision and recall are both 0', () => {
    const result = f1Score([0, 0, 0], [1, 1, 1]);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('aucRoc', () => {
  it('returns 1.0 for perfect separation', () => {
    const result = aucRoc([1, 1, 0, 0], [0.9, 0.8, 0.2, 0.1]);
    expect(result).toBe(1.0);
  });

  it('returns 0.5 when all same class (positive)', () => {
    expect(aucRoc([1, 1, 1, 1], [0.9, 0.8, 0.7, 0.6])).toBe(0.5);
  });

  it('returns 0.5 when all same class (negative)', () => {
    expect(aucRoc([0, 0, 0, 0], [0.9, 0.8, 0.7, 0.6])).toBe(0.5);
  });

  it('returns near 0 for perfectly reversed predictions', () => {
    const result = aucRoc([1, 1, 0, 0], [0.1, 0.2, 0.8, 0.9]);
    expect(result).toBe(0.0);
  });

  it('handles tied predictions', () => {
    // When all predictions are equal, AUC depends on tie-breaking order
    const result = aucRoc([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('handles larger dataset correctly', () => {
    const actual = [1, 1, 1, 0, 0, 0, 0, 0];
    const predicted = [0.9, 0.8, 0.7, 0.4, 0.3, 0.2, 0.1, 0.05];
    const result = aucRoc(actual, predicted);
    expect(result).toBe(1.0);
  });
});

describe('logLoss', () => {
  it('returns near 0 for perfect probabilities', () => {
    const result = logLoss([1, 0, 1], [0.999, 0.001, 0.999]);
    expect(result).toBeCloseTo(0.001, 2);
  });

  it('returns high value for very wrong probabilities', () => {
    const result = logLoss([1, 0], [0.01, 0.99]);
    expect(result).toBeGreaterThan(2);
  });

  it('clamps extreme values to avoid log(0)', () => {
    expect(() => logLoss([1, 0], [0, 1])).not.toThrow();
    const result = logLoss([1, 0], [0, 1]);
    expect(isFinite(result)).toBe(true);
  });

  it('returns moderate loss for uncertain predictions', () => {
    const result = logLoss([1, 0, 1, 0], [0.5, 0.5, 0.5, 0.5]);
    expect(result).toBeCloseTo(0.6931, 3);
  });

  it('is always non-negative', () => {
    const result = logLoss([1, 0, 1], [0.9, 0.1, 0.8]);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('penalizes confident wrong predictions heavily', () => {
    const confident = logLoss([1], [0.99]);
    const wrong = logLoss([1], [0.01]);
    expect(wrong).toBeGreaterThan(confident * 10);
  });
});

describe('SCORERS registry', () => {
  it('contains all 6 metrics including CUSTOM placeholder', () => {
    expect(Object.keys(SCORERS)).toHaveLength(6);
    expect(SCORERS).toHaveProperty('ACCURACY');
    expect(SCORERS).toHaveProperty('RMSE');
    expect(SCORERS).toHaveProperty('F1_SCORE');
    expect(SCORERS).toHaveProperty('AUC_ROC');
    expect(SCORERS).toHaveProperty('LOG_LOSS');
    expect(SCORERS).toHaveProperty('CUSTOM');
  });

  it('all built-in scorers are callable and return numbers', () => {
    for (const [key, fn] of Object.entries(SCORERS)) {
      expect(typeof fn).toBe('function');
      if (key === 'CUSTOM') {
        // CUSTOM is a placeholder that throws by design until host configures script
        expect(() => fn([1, 0], [1, 0])).toThrow(/CUSTOM metric/);
        continue;
      }
      const result = fn([1, 0], [1, 0]);
      expect(typeof result).toBe('number');
    }
  });
});

describe('HIGHER_IS_BETTER', () => {
  it('marks ACCURACY, F1_SCORE, AUC_ROC as higher-is-better', () => {
    expect(HIGHER_IS_BETTER.ACCURACY).toBe(true);
    expect(HIGHER_IS_BETTER.F1_SCORE).toBe(true);
    expect(HIGHER_IS_BETTER.AUC_ROC).toBe(true);
  });

  it('marks RMSE, LOG_LOSS as lower-is-better', () => {
    expect(HIGHER_IS_BETTER.RMSE).toBe(false);
    expect(HIGHER_IS_BETTER.LOG_LOSS).toBe(false);
  });

  it('covers all built-in scorers (CUSTOM is host-configured, not in registry)', () => {
    const builtIns = Object.keys(SCORERS).filter((k) => k !== 'CUSTOM').sort();
    expect(Object.keys(HIGHER_IS_BETTER).sort()).toEqual(builtIns);
  });
});
