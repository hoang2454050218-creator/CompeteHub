import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-bg">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-primary-600/20 mb-4">404</div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Không tìm thấy trang
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="btn-secondary gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
          <Link to="/" className="btn-primary gap-2">
            <Home className="h-4 w-4" />
            Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
