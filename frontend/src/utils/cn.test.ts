import { cn, formatDate, formatDateTime, timeAgo, formatFileSize } from './cn';

describe('cn (class name merge)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'end')).toBe('base end');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('handles empty call', () => {
    expect(cn()).toBe('');
  });
});

describe('formatDate', () => {
  it('formats ISO date string locale-independently', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('15');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDateTime', () => {
  it('includes time component', () => {
    const result = formatDateTime('2024-06-15T14:30:00Z');
    expect(result).toContain('2024');
  });
});

describe('timeAgo', () => {
  it('returns "Vừa xong" for recent times', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('Vừa xong');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5 phút trước');
  });

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2 giờ trước');
  });

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3 ngày trước');
  });

  it('handles single hour form', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneHourAgo)).toBe('1 giờ trước');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5242880)).toBe('5.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(2147483648)).toBe('2.0 GB');
  });

  it('handles string input', () => {
    expect(formatFileSize('1024')).toBe('1.0 KB');
  });
});
