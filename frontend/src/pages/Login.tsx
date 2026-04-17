import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Trophy, Github } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { scheduleTokenRefresh } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Sign-in failed. Please try again.',
  invalid_state: 'Sign-in expired or replayed. Please try again.',
  email_not_verified: 'Your provider account has no verified email. Please verify your email first.',
  oauth_missing_profile: 'Your provider profile is missing email or name.',
  github_no_email: 'Set a public email on your GitHub account before signing in.',
  account_exists: 'An account with this email exists. Please sign in with your password first.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    api.get('/auth/oauth-providers').then((res) => setProviders(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      toast.error(OAUTH_ERROR_MESSAGES[err] || `Sign-in error: ${err}`);
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      scheduleTokenRefresh(accessToken);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const oauthEnabled = providers.google || providers.github;

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 items-center justify-center p-12">
        <div className="max-w-md text-white">
          <Trophy className="h-16 w-16 mb-8" />
          <h1 className="text-4xl font-bold mb-4">Welcome to CompeteHub</h1>
          <p className="text-lg text-primary-100">
            Join data science competitions, showcase your skills, and climb the leaderboard.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Trophy className="h-8 w-8 text-primary-600" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">CompeteHub</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Sign in to your account</h2>
          <p className="text-gray-500 mb-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">Sign up</Link>
          </p>

          {oauthEnabled && (
            <>
              <div className="flex gap-3 mb-6">
                {providers.google && (
                  <a href={`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/google`} className="btn-secondary flex-1 gap-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </a>
                )}
                {providers.github && (
                  <a href={`${import.meta.env.VITE_API_URL || '/api/v1'}/auth/github`} className="btn-secondary flex-1 gap-2">
                    <Github className="h-5 w-5" />
                    GitHub
                  </a>
                )}
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-dark-border" /></div>
                <div className="relative flex justify-center text-sm"><span className="px-4 bg-gray-50 dark:bg-dark-bg text-gray-500">or continue with email</span></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" placeholder="you@example.com" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">Forgot?</Link>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field" placeholder="Enter your password" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
