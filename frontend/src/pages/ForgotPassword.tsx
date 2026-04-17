import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getApiErrorMessage } from '../utils/displayText';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Nếu email tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu.');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Không thể gửi liên kết đặt lại mật khẩu.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-bg">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <Link to="/login" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
          </Link>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Đặt lại mật khẩu</h2>

          {sent ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-500 mb-6">Nhập email của bạn để nhận liên kết đặt lại mật khẩu.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" placeholder="you@example.com" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
