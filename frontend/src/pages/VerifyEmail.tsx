import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trophy, CheckCircle2, XCircle, MailCheck } from 'lucide-react';
import api from '../services/api';

type State = 'verifying' | 'success' | 'already' | 'error' | 'no-token';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<State>('verifying');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('no-token');
      return;
    }
    api.post('/auth/verify-email', { token })
      .then((res) => {
        const data = res.data?.data ?? {};
        setState(data.alreadyVerified ? 'already' : 'success');
      })
      .catch((err) => {
        setErrorMsg(err?.response?.data?.message || 'Xác minh không thành công.');
        setState('error');
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-dark-bg">
      <div className="w-full max-w-md card p-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <Trophy className="h-8 w-8 text-primary-600" />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">CompeteHub</span>
        </Link>

        {state === 'verifying' && (
          <>
            <MailCheck className="h-12 w-12 text-primary-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Đang xác minh email…</h2>
            <p className="text-gray-500">Vui lòng chờ trong giây lát.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Xác minh thành công</h2>
            <p className="text-gray-500 mb-6">Email của bạn đã được xác minh. Bạn có thể đăng nhập ngay.</p>
            <Link to="/login" className="btn-primary inline-block">Đến trang đăng nhập</Link>
          </>
        )}
        {state === 'already' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Email đã được xác minh trước đó</h2>
            <Link to="/login" className="btn-primary inline-block">Đến trang đăng nhập</Link>
          </>
        )}
        {(state === 'error' || state === 'no-token') && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Không thể xác minh</h2>
            <p className="text-gray-500 mb-6">{state === 'no-token' ? 'Liên kết thiếu mã xác minh.' : errorMsg}</p>
            <Link to="/login" className="btn-secondary inline-block">Quay lại đăng nhập</Link>
          </>
        )}
      </div>
    </div>
  );
}
