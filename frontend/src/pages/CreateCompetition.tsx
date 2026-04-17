import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  getApiErrorMessage,
  getCompetitionCategoryLabel,
  getEvaluationMetricLabel,
} from '../utils/displayText';

const METRICS = ['ACCURACY', 'RMSE', 'F1_SCORE', 'AUC_ROC', 'LOG_LOSS'] as const;
const CATEGORIES = ['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY'] as const;

export default function CreateCompetition() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    rules: '',
    category: 'COMMUNITY',
    tags: '',
    prize: '',
    startDate: '',
    endDate: '',
    evalMetric: 'ACCURACY',
    pubPrivSplit: 0.3,
    maxTeamSize: 1,
    maxDailySubs: 5,
    maxFileSize: 104857600,
  });

  const update = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) return toast.error('Vui lòng nhập tiêu đề cuộc thi.');
    if (form.title.trim().length < 5) return toast.error('Tiêu đề phải có ít nhất 5 ký tự.');
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      return toast.error('Ngày kết thúc phải sau ngày bắt đầu.');
    }
    const split = Number(form.pubPrivSplit);
    if (split <= 0 || split >= 1) return toast.error('Tỷ lệ công khai/riêng tư phải nằm trong khoảng từ 0 đến 1.');
    if (Number(form.maxDailySubs) < 1) return toast.error('Số lượt nộp tối đa mỗi ngày phải từ 1 trở lên.');
    if (Number(form.maxTeamSize) < 1) return toast.error('Số thành viên tối đa phải từ 1 trở lên.');

    setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        pubPrivSplit: split,
        maxTeamSize: Number(form.maxTeamSize),
        maxDailySubs: Number(form.maxDailySubs),
        maxFileSize: Number(form.maxFileSize),
      };
      const res = await api.post('/competitions', payload);
      toast.success('Tạo cuộc thi thành công.');
      navigate(`/competitions/${res.data.data.slug}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Không thể tạo cuộc thi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Tạo cuộc thi</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Thông tin cơ bản</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tiêu đề</label>
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} required className="input-field" placeholder="Tiêu đề cuộc thi" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mô tả (Markdown)</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} className="input-field min-h-[200px] font-mono text-sm" placeholder="Mô tả chi tiết cuộc thi..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thể lệ (Markdown)</label>
            <textarea value={form.rules} onChange={(e) => update('rules', e.target.value)} className="input-field min-h-[120px] font-mono text-sm" placeholder="Nhập thể lệ cuộc thi..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Danh mục</label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input-field">
                {CATEGORIES.map((c) => <option key={c} value={c}>{getCompetitionCategoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thẻ (phân tách bằng dấu phẩy)</label>
              <input type="text" value={form.tags} onChange={(e) => update('tags', e.target.value)} className="input-field" placeholder="nlp, beginner, tabular" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Giải thưởng</label>
            <input type="text" value={form.prize} onChange={(e) => update('prize', e.target.value)} className="input-field" placeholder="Tiền mặt, học bổng hoặc quyền lợi khác" />
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chấm điểm và giới hạn</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chỉ số đánh giá</label>
              <select value={form.evalMetric} onChange={(e) => update('evalMetric', e.target.value)} className="input-field">
                {METRICS.map((m) => <option key={m} value={m}>{getEvaluationMetricLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tỷ lệ công khai/riêng tư</label>
              <input type="number" step="0.01" min="0" max="1" value={form.pubPrivSplit} onChange={(e) => update('pubPrivSplit', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số lượt nộp tối đa mỗi ngày</label>
              <input type="number" min="1" value={form.maxDailySubs} onChange={(e) => update('maxDailySubs', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số thành viên đội tối đa</label>
              <input type="number" min="1" value={form.maxTeamSize} onChange={(e) => update('maxTeamSize', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mốc thời gian</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngày bắt đầu</label>
              <input type="datetime-local" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngày kết thúc</label>
              <input type="datetime-local" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Đang tạo...' : 'Tạo cuộc thi'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Hủy</button>
        </div>
      </form>
    </div>
  );
}
