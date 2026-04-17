import { Link } from 'react-router-dom';
import { Users, Calendar, Tag } from 'lucide-react';
import { Competition } from '../types';
import { cn, formatDate } from '../utils/cn';
import { getCompetitionStatusLabel, getEvaluationMetricLabel } from '../utils/displayText';

interface Props {
  competition: Competition;
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PENDING_REVIEW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

export default function CompetitionCard({ competition }: Props) {
  return (
    <Link to={`/competitions/${competition.slug}`} className="card group hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all duration-200">
      <div className="relative h-40 overflow-hidden rounded-t-xl bg-gradient-to-br from-primary-500 to-primary-700">
        {competition.coverImage && (
          <img src={competition.coverImage} alt={competition.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        )}
        <div className="absolute top-3 left-3">
          <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusColors[competition.status])}>
            {getCompetitionStatusLabel(competition.status)}
          </span>
        </div>
        {competition.prize && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {competition.prize}
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
          {competition.title}
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-xs font-medium text-primary-700">{competition.host.name[0]}</span>
          </div>
          <span className="text-sm text-gray-500">{competition.host.name}</span>
        </div>

        {competition.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {competition.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100 dark:border-dark-border">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{competition._count?.enrollments || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="h-4 w-4" />
            <span>{getEvaluationMetricLabel(competition.evalMetric)}</span>
          </div>
          {competition.endDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(competition.endDate)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
