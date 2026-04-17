export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  role: 'ADMIN' | 'HOST' | 'PARTICIPANT';
  githubUrl?: string;
  linkedinUrl?: string;
  createdAt: string;
}

export interface Competition {
  id: string;
  hostId: string;
  title: string;
  slug: string;
  description?: string;
  rules?: string;
  coverImage?: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  category: 'FEATURED' | 'GETTING_STARTED' | 'RESEARCH' | 'COMMUNITY';
  tags: string[];
  prize?: string;
  startDate?: string;
  endDate?: string;
  evalMetric: string;
  pubPrivSplit: number;
  maxTeamSize: number;
  maxDailySubs: number;
  maxTotalSubs?: number;
  maxFileSize: number;
  createdAt: string;
  host: { id: string; name: string; avatarUrl?: string };
  _count?: { enrollments: number; submissions: number; discussions: number };
}

export interface Dataset {
  id: string;
  version: number;
  title: string;
  description?: string;
  fileName: string;
  fileSize: string;
  isPublic: boolean;
  downloadCount: number;
  createdAt: string;
}

export interface Submission {
  id: string;
  userId: string;
  competitionId: string;
  fileName: string;
  description?: string;
  status: 'QUEUED' | 'SCORING' | 'SCORED' | 'FAILED';
  publicScore?: number;
  privateScore?: number;
  errorMessage?: string;
  isSelected: boolean;
  scoredAt?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  bestPublicScore?: number;
  bestPrivateScore?: number;
  submissionCount: number;
  lastSubmittedAt?: string;
  user: { id: string; name: string; avatarUrl?: string };
  team?: { id: string; name: string };
}

export interface Discussion {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  upvoteCount: number;
  replyCount: number;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string };
  replies?: DiscussionReply[];
  _count?: { replies: number };
}

export interface DiscussionReply {
  id: string;
  content: string;
  upvoteCount: number;
  createdAt: string;
  author: { id: string; name: string; avatarUrl?: string };
  childReplies?: DiscussionReply[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  refType?: string;
  refId?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  competitionId: string;
  leader: { id: string; name: string; avatarUrl?: string };
  members: Array<{ user: { id: string; name: string; avatarUrl?: string } }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
