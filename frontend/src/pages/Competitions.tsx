import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter } from 'lucide-react';
import api from '../services/api';
import { Competition } from '../types';
import CompetitionCard from '../components/CompetitionCard';
import { PageLoader } from '../components/LoadingSpinner';
import { cn } from '../utils/cn';
import { getCompetitionCategoryLabel, getCompetitionStatusLabel } from '../utils/displayText';

const CATEGORIES = ['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY'] as const;
const SORTS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'deadline', label: 'Hạn cuối' },
];

export default function Competitions() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set('search', debouncedSearch);
  if (status) queryParams.set('status', status);
  if (category) queryParams.set('category', category);
  queryParams.set('sort', sort);
  queryParams.set('page', String(page));
  queryParams.set('limit', '12');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['competitions', debouncedSearch, status, category, sort, page],
    queryFn: () => api.get(`/competitions?${queryParams}`).then((r) => r.data),
  });

  const competitions = data?.data as Competition[] || [];
  const pagination = data?.pagination;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cuộc thi</h1>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm cuộc thi..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn('btn-secondary', showFilters && 'bg-primary-50 border-primary-300 text-primary-700')}>
            <Filter className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trạng thái</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field">
                <option value="">Tất cả</option>
                <option value="ACTIVE">{getCompetitionStatusLabel('ACTIVE')}</option>
                <option value="COMPLETED">{getCompetitionStatusLabel('COMPLETED')}</option>
                <option value="ARCHIVED">{getCompetitionStatusLabel('ARCHIVED')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Danh mục</label>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="input-field">
                <option value="">Tất cả</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{getCompetitionCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sắp xếp</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field">
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {isError ? (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Không thể tải danh sách cuộc thi</h3>
          <p className="text-gray-500">Vui lòng thử lại sau.</p>
        </div>
      ) : isLoading ? (
        <PageLoader />
      ) : competitions.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">
                Trước
              </button>
              <span className="text-sm text-gray-500">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="btn-secondary text-sm">
                Sau
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="card p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Không tìm thấy cuộc thi phù hợp</h3>
          <p className="text-gray-500">Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      )}
    </div>
  );
}
