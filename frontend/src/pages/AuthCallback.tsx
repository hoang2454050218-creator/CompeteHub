import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api, { scheduleTokenRefresh } from '../services/api';
import { PageLoader } from '../components/LoadingSpinner';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?error=${error}`, { replace: true });
      return;
    }

    if (code) {
      window.history.replaceState(null, '', window.location.pathname);
      api.post('/auth/exchange-code', { code })
        .then((res) => {
          const { user, accessToken } = res.data.data;
          setAuth(user, accessToken);
          scheduleTokenRefresh(accessToken);
          navigate('/', { replace: true });
        })
        .catch(() => navigate('/login?error=oauth_failed', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate, setAuth, searchParams]);

  return <PageLoader />;
}
