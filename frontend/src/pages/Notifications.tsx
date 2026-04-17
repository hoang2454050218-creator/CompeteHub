import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react';
import api from '../services/api';
import { Notification } from '../types';
import { PageLoader } from '../components/LoadingSpinner';
import { cn, timeAgo } from '../utils/cn';

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=50').then((r) => r.data.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) return <PageLoader />;
  if (isError) return <div className="max-w-3xl mx-auto px-4 py-8"><div className="card p-12 text-center"><h3 className="text-lg font-medium text-red-600 mb-2">Failed to load notifications</h3><p className="text-gray-500">Please try again later.</p></div></div>;

  const notifications = data?.notifications as Notification[] || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending} className="btn-secondary text-sm gap-1 disabled:opacity-50">
            <CheckCheck className="h-4 w-4" /> {markAllMutation.isPending ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
            className={cn(
              'card p-4 cursor-pointer transition-colors',
              !n.isRead && 'border-l-4 border-l-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', n.isRead ? 'bg-gray-100' : 'bg-primary-100')}>
                  <Bell className={cn('h-4 w-4', n.isRead ? 'text-gray-400' : 'text-primary-600')} />
                </div>
                <div>
                  <h3 className={cn('font-medium', n.isRead ? 'text-gray-600' : 'text-gray-900 dark:text-white')}>{n.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-4">{timeAgo(n.createdAt)}</span>
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="card p-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No notifications</h3>
            <p className="text-gray-500">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}
