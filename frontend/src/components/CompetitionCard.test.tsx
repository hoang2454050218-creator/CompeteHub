import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompetitionCard from './CompetitionCard';
import { Competition } from '../types';

const mockCompetition: Competition = {
  id: 'comp-1',
  hostId: 'host-1',
  title: 'Titanic Survival Prediction',
  slug: 'titanic-survival',
  description: 'Predict survival',
  status: 'ACTIVE',
  category: 'GETTING_STARTED',
  tags: ['beginner', 'tabular'],
  prize: '$10,000',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  evalMetric: 'ACCURACY',
  pubPrivSplit: 0.3,
  maxTeamSize: 4,
  maxDailySubs: 5,
  maxFileSize: 104857600,
  createdAt: '2024-01-01',
  host: { id: 'h1', name: 'DataOrg' },
  _count: { enrollments: 1234, submissions: 5000, discussions: 50 },
};

function renderCard(comp: Competition = mockCompetition) {
  return render(
    <MemoryRouter>
      <CompetitionCard competition={comp} />
    </MemoryRouter>
  );
}

describe('CompetitionCard', () => {
  it('renders competition title', () => {
    renderCard();
    expect(screen.getByText('Titanic Survival Prediction')).toBeTruthy();
  });

  it('renders host name', () => {
    renderCard();
    expect(screen.getByText('DataOrg')).toBeTruthy();
  });

  it('renders tags', () => {
    renderCard();
    expect(screen.getByText('beginner')).toBeTruthy();
    expect(screen.getByText('tabular')).toBeTruthy();
  });

  it('renders status badge', () => {
    renderCard();
    expect(screen.getByText('Đang diễn ra')).toBeTruthy();
  });

  it('renders prize', () => {
    renderCard();
    expect(screen.getByText('$10,000')).toBeTruthy();
  });

  it('renders participant count', () => {
    renderCard();
    expect(screen.getByText('1234')).toBeTruthy();
  });

  it('renders eval metric', () => {
    renderCard();
    expect(screen.getByText('Độ chính xác')).toBeTruthy();
  });

  it('links to competition detail page', () => {
    renderCard();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/competitions/titanic-survival');
  });

  it('handles competition without prize', () => {
    renderCard({ ...mockCompetition, prize: undefined });
    expect(screen.queryByText('$10,000')).toBeNull();
  });

  it('limits displayed tags to 3', () => {
    renderCard({ ...mockCompetition, tags: ['a', 'b', 'c', 'd', 'e'] });
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('c')).toBeTruthy();
    expect(screen.queryByText('d')).toBeNull();
  });
});
