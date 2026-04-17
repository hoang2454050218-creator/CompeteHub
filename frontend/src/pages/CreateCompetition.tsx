import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

const METRICS = ['ACCURACY', 'RMSE', 'F1_SCORE', 'AUC_ROC', 'LOG_LOSS'];
const CATEGORIES = ['FEATURED', 'GETTING_STARTED', 'RESEARCH', 'COMMUNITY'];

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

  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) return toast.error('Title is required');
    if (form.title.trim().length < 5) return toast.error('Title must be at least 5 characters');
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) {
      return toast.error('End date must be after start date');
    }
    const split = Number(form.pubPrivSplit);
    if (split <= 0 || split >= 1) return toast.error('Public/Private split must be between 0 and 1');
    if (Number(form.maxDailySubs) < 1) return toast.error('Daily submissions must be at least 1');
    if (Number(form.maxTeamSize) < 1) return toast.error('Team size must be at least 1');

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
      toast.success('Competition created!');
      navigate(`/competitions/${res.data.data.slug}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Create Competition</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} required className="input-field" placeholder="Competition title" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Markdown)</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} className="input-field min-h-[200px] font-mono text-sm" placeholder="Describe your competition..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rules (Markdown)</label>
            <textarea value={form.rules} onChange={(e) => update('rules', e.target.value)} className="input-field min-h-[120px] font-mono text-sm" placeholder="Competition rules..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input-field">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (comma-separated)</label>
              <input type="text" value={form.tags} onChange={(e) => update('tags', e.target.value)} className="input-field" placeholder="nlp, beginner, tabular" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prize</label>
            <input type="text" value={form.prize} onChange={(e) => update('prize', e.target.value)} className="input-field" placeholder="$10,000 or Knowledge" />
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scoring & Limits</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Evaluation Metric</label>
              <select value={form.evalMetric} onChange={(e) => update('evalMetric', e.target.value)} className="input-field">
                {METRICS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public/Private Split</label>
              <input type="number" step="0.01" min="0" max="1" value={form.pubPrivSplit} onChange={(e) => update('pubPrivSplit', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Daily Submissions</label>
              <input type="number" min="1" value={form.maxDailySubs} onChange={(e) => update('maxDailySubs', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Team Size</label>
              <input type="number" min="1" value={form.maxTeamSize} onChange={(e) => update('maxTeamSize', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Timeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input type="datetime-local" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="datetime-local" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Competition'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
