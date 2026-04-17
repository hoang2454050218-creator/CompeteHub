import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Github, Linkedin, Calendar, Trophy, BarChart3 } from 'lucide-react';
import api from '../services/api';
import { PageLoader } from '../components/LoadingSpinner';
import { formatDate } from '../utils/cn';
import { getCompetitionStatusLabel, getEvaluationMetricLabel } from '../utils/displayText';

export default function Profile() {
  const { id } = useParams<{ id: string }>();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.get(`/users/${id}`).then((r) => r.data.data),
  });

  if (isLoading) return <PageLoader />;
  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="card p-12">
          <h3 className="text-lg font-medium text-red-600 mb-2">Không thể tải hồ sơ</h3>
          <p className="text-gray-500">Vui lòng thử lại sau.</p>
        </div>
      </div>
    );
  }
  if (!profile) return <div className="text-center py-20">Không tìm thấy người dùng</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="card p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center text-3xl font-bold text-primary-700 flex-shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              profile.name[0]?.toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
            {profile.email && <p className="text-gray-500 mb-3">{profile.email}</p>}
            {profile.bio && <p className="text-gray-600 dark:text-gray-400 mb-3">{profile.bio}</p>}

            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Tham gia từ {formatDate(profile.createdAt)}</span>
              <span className="flex items-center gap-1"><Trophy className="h-4 w-4" /> {profile._count?.enrollments || 0} cuộc thi</span>
              <span className="flex items-center gap-1"><BarChart3 className="h-4 w-4" /> {profile._count?.submissions || 0} bài nộp</span>
              {profile.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-gray-700">
                  <Github className="h-4 w-4" /> GitHub
                </a>
              )}
              {profile.linkedinUrl && (
                <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-gray-700">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {profile.bestResults?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Thành tích nổi bật</h2>
          <div className="space-y-3">
            {profile.bestResults.map((result: any) => (
              <div key={result.id} className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{result.competition.title}</h3>
                  <p className="text-sm text-gray-500">Hạng #{result.publicRank || '-'}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium text-primary-600">{result.bestPublicScore?.toFixed(5)}</div>
                  <div className="text-xs text-gray-500">{result.submissionCount} bài nộp</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.competitionHistory?.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Lịch sử tham gia</h2>
          <div className="space-y-3">
            {profile.competitionHistory.map((entry: any) => (
              <div key={entry.id} className="card p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{entry.competition.title}</h3>
                  <p className="text-sm text-gray-500">
                    {getCompetitionStatusLabel(entry.competition.status)} &middot; {getEvaluationMetricLabel(entry.competition.evalMetric)}
                  </p>
                </div>
                <span className="text-sm text-gray-500">{formatDate(entry.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
