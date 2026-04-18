import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'cookieConsent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const persist = (value: 'accepted' | 'dismissed') => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Thông báo sử dụng cookie"
      aria-describedby="cookie-consent-body"
      className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
            <Cookie className="h-5 w-5 text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Chúng tôi sử dụng cookie</h3>
            <p id="cookie-consent-body" className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
              CompeteHub chỉ dùng cookie kỹ thuật để duy trì phiên đăng nhập và lưu tuỳ chọn giao diện. Không có
              tracking, không quảng cáo. Xem{' '}
              <Link to="/cookies" className="text-primary-600 hover:text-primary-700 underline underline-offset-2">
                Chính sách Cookie
              </Link>
              .
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => persist('accepted')}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Đồng ý
              </button>
              <button
                onClick={() => persist('dismissed')}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
              >
                Chỉ cookie cần thiết
              </button>
            </div>
          </div>
          <button
            onClick={() => persist('dismissed')}
            aria-label="Đóng thông báo"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 -mt-1 -mr-1 p-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}