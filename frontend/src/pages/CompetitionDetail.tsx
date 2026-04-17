import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy, Users, Calendar, BarChart3, Upload, MessageSquare, FileText,
  ChevronRight, Download,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Competition, Dataset, Submission, LeaderboardEntry, Discussion } from '../types';
import { PageLoader } from '../components/LoadingSpinner';
import { SectionErrorBoundary } from '../components/ErrorBoundary';
import { cn, formatDate, formatFileSize, timeAgo } from '../utils/cn';
import { joinCompetition, joinLeaderboard, leaveCompetition } from '../socket';

type Tab = 'overview' | 'data' | 'leaderboard' | 'submissions' | 'discussion' | 'rules';

export default function CompetitionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');

  const { data: competition, isLoading, isError } = useQuery({
    queryKey: ['competition', slug],
    queryFn: () => api.get(`/competitions/${slug}`).then((r) => r.data.data as Competition),
  });

  const { data: enrolled } = useQuery({
    queryKey: ['enrollment', competition?.id],
    queryFn: () => api.get(`/competitions/${competition!.id}/enrollment`).then((r) => r.data.data.enrolled as boolean),
    enabled: !!competition && isAuthenticated,
  });

  const enrollMutation = useMutation({
    mutationFn: () => api.post(`/competitions/${competition!.id}/enroll`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', competition!.id] });
      queryClient.invalidateQueries({ queryKey: ['competition', slug] });
      toast.success('Enrolled successfully!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to enroll'),
  });

  // AUDIT-FIX: Clean up socket rooms on unmount
  useEffect(() => {
    if (competition?.id) {
      joinCompetition(competition.id);
      joinLeaderboard(competition.id);
    }
    return () => {
      if (competition?.id) {
        leaveCompetition(competition.id);
      }
    };
  }, [competition?.id]);

  if (isLoading) return <PageLoader />;
  if (isError) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="card p-12">
        <Trophy className="h-12 w-12 mx-auto text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load competition</h2>
        <p className="text-gray-500 mb-4">Please check the URL or try again later.</p>
        <a href="/competitions" className="btn-primary">Browse Competitions</a>
      </div>
    </div>
  );
  if (!competition) return <div className="text-center py-20">Competition not found</div>;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'data', label: 'Data', icon: Download },
    { id: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
    { id: 'submissions', label: 'Submissions', icon: Upload },
    { id: 'discussion', label: 'Discussion', icon: MessageSquare },
    { id: 'rules', label: 'Rules', icon: FileText },
  ];

  return (
    <div>
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3 text-primary-200 text-sm">
                <Link to="/competitions" className="hover:text-white">Competitions</Link>
                <ChevronRight className="h-4 w-4" />
                <span>{competition.category.replace('_', ' ')}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">{competition.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-primary-200">
                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{competition._count?.enrollments || 0} participants</span>
                <span className="flex items-center gap-1"><BarChart3 className="h-4 w-4" />{competition.evalMetric.replace('_', ' ')}</span>
                {competition.endDate && <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Ends {formatDate(competition.endDate)}</span>}
                {competition.prize && <span className="flex items-center gap-1"><Trophy className="h-4 w-4" />{competition.prize}</span>}
              </div>
            </div>

            <div className="flex gap-3">
              {isAuthenticated && !enrolled && competition.status === 'ACTIVE' && (
                <button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending} className="px-6 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-colors">
                  {enrollMutation.isPending ? 'Joining...' : 'Join Competition'}
                </button>
              )}
              {enrolled && (
                <span className="px-4 py-2 bg-green-500/20 text-green-100 rounded-lg font-medium border border-green-400/30">Enrolled</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  tab === id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SectionErrorBoundary key={tab}>
          {tab === 'overview' && <OverviewTab competition={competition} />}
          {tab === 'data' && <DataTab competitionId={competition.id} enrolled={!!enrolled} />}
          {tab === 'leaderboard' && <LeaderboardTab competitionId={competition.id} status={competition.status} />}
          {tab === 'submissions' && <SubmissionsTab competitionId={competition.id} enrolled={!!enrolled} />}
          {tab === 'discussion' && <DiscussionTab competitionId={competition.id} enrolled={!!enrolled} />}
          {tab === 'rules' && <RulesTab competition={competition} />}
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

function OverviewTab({ competition }: { competition: Competition }) {
  return (
    <div className="prose prose-lg max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {competition.description || 'No description provided.'}
      </ReactMarkdown>
    </div>
  );
}

function DataTab({ competitionId, enrolled }: { competitionId: string; enrolled: boolean }) {
  const { data: datasets } = useQuery({
    queryKey: ['datasets', competitionId],
    queryFn: () => api.get(`/competitions/${competitionId}/datasets`).then((r) => r.data.data as Dataset[]),
  });

  const handleDownload = async (datasetId: string) => {
    try {
      const res = await api.get(`/competitions/${competitionId}/datasets/${datasetId}/download`);
      window.open(res.data.data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Download failed');
    }
  };

  return (
    <div className="space-y-4">
      {datasets?.map((ds) => (
        <div key={ds.id} className="card p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{ds.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              v{ds.version} &middot; {formatFileSize(ds.fileSize)} &middot; {ds.downloadCount} downloads
            </p>
            {ds.description && <p className="text-sm text-gray-600 mt-1">{ds.description}</p>}
          </div>
          <div className="flex gap-2">
            {enrolled && (
              <button onClick={() => handleDownload(ds.id)} className="btn-primary text-sm">
                <Download className="h-4 w-4 mr-1" /> Download
              </button>
            )}
          </div>
        </div>
      ))}
      {(!datasets || datasets.length === 0) && (
        <div className="card p-8 text-center text-gray-500">No datasets uploaded yet.</div>
      )}
    </div>
  );
}

function LeaderboardTab({ competitionId, status }: { competitionId: string; status: string }) {
  const [board, setBoard] = useState<'public' | 'private'>('public');
  const [page, setPage] = useState(1);
  const { user } = useAuthStore();

  const { data: response } = useQuery({
    queryKey: ['leaderboard', competitionId, board, page],
    queryFn: () => api.get(`/competitions/${competitionId}/leaderboard${board === 'private' ? '/private' : ''}`, { params: { page, limit: 50 } }).then((r) => ({
      entries: r.data.data as LeaderboardEntry[],
      pagination: r.data.pagination as { page: number; totalPages: number; total: number },
    })),
    refetchInterval: 30_000,
  });

  const showPrivate = status === 'COMPLETED' || status === 'ARCHIVED';
  const entries = response?.entries || [];
  const pagination = response?.pagination;

  return (
    <div>
      {showPrivate && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => { setBoard('public'); setPage(1); }} className={cn('btn-secondary text-sm', board === 'public' && 'bg-primary-50 border-primary-300 text-primary-700')}>Public</button>
          <button onClick={() => { setBoard('private'); setPage(1); }} className={cn('btn-secondary text-sm', board === 'private' && 'bg-primary-50 border-primary-300 text-primary-700')}>Private</button>
        </div>
      )}

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Team / User</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Score</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Entries</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Last</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {entries.map((entry) => {
              const isMe = user?.id === entry.user.id;
              const rank = entry.rank;
              return (
                <tr key={entry.id} className={cn(
                  'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  rank <= 3 && 'bg-yellow-50/50 dark:bg-yellow-900/10',
                  isMe && 'ring-2 ring-inset ring-primary-400'
                )}>
                  <td className="px-4 py-3">
                    <span className={cn('font-bold', rank === 1 && 'text-yellow-500', rank === 2 && 'text-gray-400', rank === 3 && 'text-amber-700')}>
                      {rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                        {entry.user.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{entry.team?.name || entry.user.name}{isMe && ' (you)'}</div>
                        {entry.team && <div className="text-xs text-gray-500">{entry.user.name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900 dark:text-white">
                    {(board === 'private' ? entry.bestPrivateScore : entry.bestPublicScore)?.toFixed(5) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{entry.submissionCount}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-sm">
                    {entry.lastSubmittedAt ? timeAgo(entry.lastSubmittedAt) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="p-8 text-center text-gray-500">No submissions yet.</div>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{pagination.total} participants</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">Previous</button>
            <span className="flex items-center px-3 text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {pagination.totalPages}
            </span>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="btn-secondary text-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionsTab({ competitionId, enrolled }: { competitionId: string; enrolled: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [desc, setDesc] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const { data: submissions } = useQuery({
    queryKey: ['submissions', competitionId],
    queryFn: () => api.get(`/competitions/${competitionId}/submissions`).then((r) => r.data.data as Submission[]),
    enabled: enrolled,
    refetchInterval: 10_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append('file', file!);
      if (desc) formData.append('description', desc);
      setUploadProgress(0);
      return api.post(`/competitions/${competitionId}/submissions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', competitionId] });
      setFile(null);
      setDesc('');
      setUploadProgress(0);
      toast.success('Submission uploaded! Scoring in progress...');
    },
    onError: (err: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      setUploadProgress(0);
      toast.error(err.response?.data?.message || 'Submission failed');
    },
  });

  const selectMutation = useMutation({
    mutationFn: (submissionId: string) => api.patch(`/competitions/${competitionId}/submissions/${submissionId}/select`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', competitionId] });
      toast.success('Submission selected for private leaderboard');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to select'), // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  if (!enrolled) {
    return <div className="card p-8 text-center text-gray-500">Join the competition to submit.</div>;
  }

  const statusColors: Record<string, string> = {
    QUEUED: 'bg-yellow-100 text-yellow-700',
    SCORING: 'bg-blue-100 text-blue-700',
    SCORED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Submit Prediction</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CSV File</label>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] || null); }}
              onClick={() => document.getElementById('csv-upload')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">{file ? file.name : 'Drag & drop your CSV file, or click to browse'}</p>
              {file && <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
              <input id="csv-upload" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field" placeholder="e.g., XGBoost v3 tuned" />
          </div>
          {submitMutation.isPending && uploadProgress > 0 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
            </div>
          )}
          <button onClick={() => submitMutation.mutate()} disabled={!file || submitMutation.isPending} className="btn-primary">
            {submitMutation.isPending ? `Uploading${uploadProgress > 0 ? ` (${uploadProgress}%)` : ''}...` : 'Submit'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-dark-border">
          <h3 className="font-semibold text-gray-900 dark:text-white">My Submissions</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">File</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Public Score</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Submitted</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Selected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {submissions?.map((sub) => (
              <tr key={sub.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-800/50', sub.isSelected && 'bg-primary-50/50 dark:bg-primary-900/10')}>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">{sub.fileName}</div>
                  {sub.description && <div className="text-gray-500 text-xs">{sub.description}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusColors[sub.status])}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">{sub.publicScore?.toFixed(5) ?? '-'}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-500">{timeAgo(sub.createdAt)}</td>
                <td className="px-4 py-3 text-center">
                  {sub.status === 'SCORED' && (
                    sub.isSelected ? (
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">Selected</span>
                    ) : (
                      <button
                        onClick={() => selectMutation.mutate(sub.id)}
                        disabled={selectMutation.isPending}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Select
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!submissions || submissions.length === 0) && (
          <div className="p-8 text-center text-gray-500">No submissions yet.</div>
        )}
      </div>
    </div>
  );
}

function DiscussionTab({ competitionId, enrolled }: { competitionId: string; enrolled: boolean }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: discussions } = useQuery({
    queryKey: ['discussions', competitionId],
    queryFn: () => api.get(`/competitions/${competitionId}/discussions`).then((r) => r.data.data as Discussion[]),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post(`/competitions/${competitionId}/discussions`, { title, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions', competitionId] });
      setTitle('');
      setContent('');
      setShowForm(false);
      toast.success('Topic created!');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  return (
    <div className="space-y-4">
      {enrolled && (
        <div className="flex justify-end">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">New Topic</button>
        </div>
      )}

      {showForm && (
        <div className="card p-5 space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Topic title" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input-field min-h-[120px]" placeholder="Write your post (Markdown supported)" />
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()} disabled={!title || !content || createMutation.isPending} className="btn-primary text-sm">{createMutation.isPending ? 'Posting...' : 'Post'}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {discussions?.map((disc) => (
        <div key={disc.id} className="card p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {disc.isPinned && <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs font-medium">Pinned</span>}
                <h3 className="font-semibold text-gray-900 dark:text-white">{disc.title}</h3>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span>{disc.author.name}</span>
                <span>{timeAgo(disc.createdAt)}</span>
                <span>{disc._count?.replies || disc.replyCount} replies</span>
                <span>{disc.upvoteCount} votes</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      {(!discussions || discussions.length === 0) && (
        <div className="card p-8 text-center text-gray-500">No discussions yet. Start one!</div>
      )}
    </div>
  );
}

function RulesTab({ competition }: { competition: Competition }) {
  return (
    <div className="prose prose-lg max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {competition.rules || 'No rules specified.'}
      </ReactMarkdown>

      <div className="not-prose mt-8 card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Competition Settings</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><dt className="text-sm text-gray-500">Evaluation Metric</dt><dd className="font-medium">{competition.evalMetric.replace('_', ' ')}</dd></div>
          <div><dt className="text-sm text-gray-500">Public/Private Split</dt><dd className="font-medium">{Math.round(competition.pubPrivSplit * 100)}% / {Math.round((1 - competition.pubPrivSplit) * 100)}%</dd></div>
          <div><dt className="text-sm text-gray-500">Max Daily Submissions</dt><dd className="font-medium">{competition.maxDailySubs}</dd></div>
          <div><dt className="text-sm text-gray-500">Max Team Size</dt><dd className="font-medium">{competition.maxTeamSize}</dd></div>
          <div><dt className="text-sm text-gray-500">Max File Size</dt><dd className="font-medium">{formatFileSize(competition.maxFileSize)}</dd></div>
          {competition.startDate && <div><dt className="text-sm text-gray-500">Start Date</dt><dd className="font-medium">{formatDate(competition.startDate)}</dd></div>}
          {competition.endDate && <div><dt className="text-sm text-gray-500">End Date</dt><dd className="font-medium">{formatDate(competition.endDate)}</dd></div>}
        </dl>
      </div>
    </div>
  );
}
