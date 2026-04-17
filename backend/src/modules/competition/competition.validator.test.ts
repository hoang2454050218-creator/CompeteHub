import { createCompetitionSchema, updateCompetitionSchema, listCompetitionsSchema } from './competition.validator';

describe('createCompetitionSchema', () => {
  const validInput = {
    title: 'Test Competition',
    description: 'A test',
    evalMetric: 'ACCURACY',
    category: 'COMMUNITY',
  };

  it('accepts valid input with defaults', () => {
    const result = createCompetitionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pubPrivSplit).toBe(0.3);
      expect(result.data.maxTeamSize).toBe(1);
      expect(result.data.maxDailySubs).toBe(5);
      expect(result.data.tags).toEqual([]);
    }
  });

  it('rejects title shorter than 3 chars', () => {
    expect(createCompetitionSchema.safeParse({ ...validInput, title: 'AB' }).success).toBe(false);
  });

  it('rejects invalid evalMetric', () => {
    expect(createCompetitionSchema.safeParse({ ...validInput, evalMetric: 'INVALID' }).success).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(createCompetitionSchema.safeParse({ ...validInput, category: 'INVALID' }).success).toBe(false);
  });

  it('rejects pubPrivSplit outside 0-1', () => {
    expect(createCompetitionSchema.safeParse({ ...validInput, pubPrivSplit: 1.5 }).success).toBe(false);
    expect(createCompetitionSchema.safeParse({ ...validInput, pubPrivSplit: -0.1 }).success).toBe(false);
  });

  it('accepts valid tags array', () => {
    const result = createCompetitionSchema.safeParse({ ...validInput, tags: ['nlp', 'beginner'] });
    expect(result.success).toBe(true);
  });
});

describe('updateCompetitionSchema', () => {
  it('accepts partial updates', () => {
    expect(updateCompetitionSchema.safeParse({ title: 'New Title' }).success).toBe(true);
    expect(updateCompetitionSchema.safeParse({}).success).toBe(true);
  });

  it('still validates field constraints', () => {
    expect(updateCompetitionSchema.safeParse({ title: 'AB' }).success).toBe(false);
  });
});

describe('listCompetitionsSchema', () => {
  it('provides defaults for empty query', () => {
    const result = listCompetitionsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe('newest');
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(12);
    }
  });

  it('coerces string page/limit to number', () => {
    const result = listCompetitionsSchema.safeParse({ page: '3', limit: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects invalid status', () => {
    expect(listCompetitionsSchema.safeParse({ status: 'INVALID' }).success).toBe(false);
  });

  it('rejects limit above 50', () => {
    expect(listCompetitionsSchema.safeParse({ limit: '100' }).success).toBe(false);
  });
});
