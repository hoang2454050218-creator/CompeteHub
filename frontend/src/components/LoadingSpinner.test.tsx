import { render, screen } from '@testing-library/react';
import LoadingSpinner, { PageLoader } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders spinner element', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('applies size classes', () => {
    const { container: small } = render(<LoadingSpinner size="sm" />);
    expect(small.querySelector('.h-4')).toBeTruthy();

    const { container: large } = render(<LoadingSpinner size="lg" />);
    expect(large.querySelector('.h-12')).toBeTruthy();
  });

  it('accepts custom className', () => {
    const { container } = render(<LoadingSpinner className="my-custom" />);
    expect(container.querySelector('.my-custom')).toBeTruthy();
  });
});

describe('PageLoader', () => {
  it('renders centered loader', () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(container.querySelector('.min-h-\\[60vh\\]')).toBeTruthy();
  });
});
