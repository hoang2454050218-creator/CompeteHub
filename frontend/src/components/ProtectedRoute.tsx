import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { PageLoader } from './LoadingSpinner';
import { ShieldX } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, user, isRehydrating } = useAuthStore();
  const location = useLocation();

  if (isRehydrating) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <ShieldX className="h-16 w-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-6">You don&apos;t have permission to access this page.</p>
          <a href="/" className="btn-primary">Go Home</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
