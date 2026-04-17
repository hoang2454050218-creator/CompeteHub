import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Trophy, BarChart3, FileText, CheckCircle, XCircle, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PageLoader } from '../components/LoadingSpinner';
import { cn, formatDate } from '../utils/cn';

type Tab = 'overview' | 'competitions' | 'users';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-primary-600" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {(['overview', 'competitions', 'users'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-card dark:text-gray-300'
            )}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'competitions' && <CompetitionsTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}

function OverviewTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data.data),
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <div className="card p-8 text-center text-red-500">Failed to load dashboard data.</div>;

  const stats = data?.stats;
  const cards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-600 bg-blue-100' },
    { label: 'Competitions', value: stats?.totalCompetitions || 0, icon: Trophy, color: 'text-green-600 bg-green-100' },
    { label: 'Submissions', value: stats?.totalSubmissions || 0, icon: BarChart3, color: 'text-purple-600 bg-purple-100' },
    { label: 'Pending Review', value: stats?.pendingReview || 0, icon: FileText, color: 'text-yellow-600 bg-yellow-100' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
              </div>
              <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center', color)}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {data?.submissionsByDay?.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Submissions (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.submissionsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CompetitionsTab() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin', 'competitions'],
    queryFn: () => api.get('/competitions?status=PENDING_REVIEW&limit=50').then((r) => r.data.data),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.patch(`/admin/competitions/${id}/review`, { action }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(`Competition ${action}d`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pending Review</h2>
      {data?.map((comp: any) => (
        <div key={comp.id} className="card p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{comp.title}</h3>
            <p className="text-sm text-gray-500 mt-1">By {comp.host.name} &middot; {comp.category}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => reviewMutation.mutate({ id: comp.id, action: 'approve' })} disabled={reviewMutation.isPending} className="btn-primary text-sm gap-1">
              <CheckCircle className="h-4 w-4" /> {reviewMutation.isPending ? '...' : 'Approve'}
            </button>
            <button onClick={() => reviewMutation.mutate({ id: comp.id, action: 'reject' })} disabled={reviewMutation.isPending} className="btn-danger text-sm gap-1">
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
        </div>
      ))}
      {(!data || data.length === 0) && (
        <div className="card p-8 text-center text-gray-500">No competitions pending review.</div>
      )}
    </div>
  );
}

function UsersTab() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearch(value), 300);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api.get(`/admin/users?search=${search}&limit=50`).then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: string; isActive?: boolean }) =>
      api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('User updated');
    },
  });

  if (isError) return <div className="card p-8 text-center text-red-500">Failed to load users.</div>;
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <input type="text" value={searchInput} onChange={(e) => handleSearch(e.target.value)} className="input-field max-w-sm" placeholder="Search users..." />

      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
            {data?.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                  <div className="text-sm text-gray-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => updateMutation.mutate({ id: u.id, role: e.target.value })}
                    className="input-field text-sm py-1"
                  >
                    <option value="PARTICIPANT">Participant</option>
                    <option value="HOST">Host</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('px-2 py-1 rounded-full text-xs font-medium', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => updateMutation.mutate({ id: u.id, isActive: !u.isActive })}
                    className={cn('text-sm font-medium', u.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700')}
                  >
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
