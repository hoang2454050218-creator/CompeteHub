import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, User as UserIcon, Bell, Lock, ExternalLink, ShieldCheck, Smartphone, FileDown, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { getApiErrorMessage } from '../utils/displayText';

type TabId = 'profile' | 'security' | 'notifications' | 'privacy';

const TABS: Array<{ id: TabId; label: string; icon: typeof UserIcon }> = [
  { id: 'profile', label: 'Hồ sơ', icon: UserIcon },
  { id: 'security', label: 'Bảo mật', icon: Shield },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'privacy', label: 'Quyền riêng tư', icon: Lock },
];

export default function Settings() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Cài đặt tài khoản</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý hồ sơ, bảo mật, thông báo và quyền riêng tư của bạn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 md:gap-8">
        <nav aria-label="Cài đặt" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                  active
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="card p-6">
          {tab === 'profile' && <ProfileTab userId={user?.id} />}
          {tab === 'security' && <SecurityTab userId={user?.id} />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'privacy' && <PrivacyTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ userId }: { userId?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Hồ sơ</h2>
      <p className="text-sm text-gray-500 mb-6">Cập nhật ảnh đại diện, tiểu sử và liên kết mạng xã hội từ trang hồ sơ công khai.</p>
      <Link to={`/profile/${userId ?? ''}`} className="btn-primary inline-flex items-center gap-2">
        Mở hồ sơ <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}

interface MeData {
  emailVerified?: boolean;
  totpEnabled?: boolean;
  notificationPreferences?: Record<string, boolean> | null;
}

function SecurityTab({ userId }: { userId?: string }) {
  void userId;
  const [me, setMe] = useState<MeData | null>(null);
  const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((r) => setMe(r.data?.data || null)).catch(() => {});
  }, []);

  const beginSetup = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/mfa/setup');
      setSetupData(res.data.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không khởi tạo MFA được'));
    } finally {
      setLoading(false);
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      const res = await api.post('/auth/mfa/enable', { code });
      setBackupCodes(res.data.data.backupCodes);
      setSetupData(null);
      setCode('');
      setMe((prev) => (prev ? { ...prev, totpEnabled: true } : prev));
      toast.success('Đã bật xác thực 2 yếu tố. Hãy lưu mã dự phòng.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể bật MFA'));
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      await api.post('/auth/mfa/disable', { password: pwd });
      setMe((prev) => (prev ? { ...prev, totpEnabled: false } : prev));
      setBackupCodes(null);
      setPwd('');
      toast.success('Đã tắt MFA');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể tắt MFA'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bảo mật</h2>

      <section className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className={`h-5 w-5 ${me?.emailVerified ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">Xác minh email</h3>
          <p className="text-sm text-gray-500 mt-1">
            {me?.emailVerified
              ? 'Email của bạn đã được xác minh.'
              : 'Hãy kiểm tra hộp thư và bấm vào liên kết xác minh.'}
          </p>
        </div>
      </section>

      <section className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
          <Smartphone className={`h-5 w-5 ${me?.totpEnabled ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-gray-900 dark:text-white">Xác thực 2 yếu tố (TOTP)</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              me?.totpEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {me?.totpEnabled ? 'Đang bật' : 'Đang tắt'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Yêu cầu mã 6 chữ số từ ứng dụng Authenticator mỗi lần đăng nhập.
          </p>

          {me?.totpEnabled ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Nhập mật khẩu để xác nhận tắt"
                className="input-field flex-1"
              />
              <button onClick={disable} disabled={loading || !pwd} className="btn-secondary whitespace-nowrap">
                Tắt MFA
              </button>
            </div>
          ) : setupData ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Quét mã QR bằng Google Authenticator, Authy hoặc 1Password:
              </p>
              <img src={setupData.qrDataUrl} alt="Mã QR cấu hình MFA" className="h-44 w-44 border border-gray-200 dark:border-dark-border rounded-lg p-2 bg-white" />
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Hoặc nhập thủ công</summary>
                <code className="block mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded font-mono text-xs break-all">{setupData.secret}</code>
              </details>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Mã 6 chữ số"
                  className="input-field flex-1"
                  inputMode="numeric"
                  maxLength={8}
                />
                <button onClick={enable} disabled={loading || code.length < 6} className="btn-primary whitespace-nowrap">
                  Xác nhận bật
                </button>
              </div>
            </div>
          ) : (
            <button onClick={beginSetup} disabled={loading} className="btn-primary">
              Khởi tạo MFA
            </button>
          )}

          {backupCodes && (
            <div className="mt-5 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
              <p className="font-medium text-yellow-900 dark:text-yellow-200 text-sm mb-2">
                Mã dự phòng — chỉ hiển thị một lần. Hãy lưu nơi an toàn.
              </p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-yellow-900 dark:text-yellow-200">
                {backupCodes.map((c) => <li key={c} className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded">{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function NotificationsTab() {
  const TYPES = [
    { code: 'SUBMISSION_SCORED', label: 'Chấm điểm bài nộp' },
    { code: 'TEAM_INVITE', label: 'Lời mời tham gia đội' },
    { code: 'COMPETITION_STATUS_CHANGED', label: 'Cập nhật trạng thái cuộc thi' },
    { code: 'NEW_DISCUSSION', label: 'Thảo luận mới' },
    { code: 'NEW_REPLY', label: 'Phản hồi mới' },
    { code: 'NEW_FOLLOWER', label: 'Người theo dõi mới' },
    { code: 'BADGE_AWARDED', label: 'Nhận huy hiệu' },
    { code: 'SYSTEM', label: 'Thông báo hệ thống' },
  ];
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((r) => {
      const initial = r.data?.data?.notificationPreferences || {};
      const merged: Record<string, boolean> = {};
      TYPES.forEach((t) => { merged[t.code] = initial[t.code] !== false; });
      setPrefs(merged);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/users/me/notification-preferences', { preferences: prefs });
      toast.success('Đã lưu tuỳ chọn thông báo');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể lưu'));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <p className="text-sm text-gray-500">Đang tải...</p>;
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tuỳ chọn thông báo</h2>
        <p className="text-sm text-gray-500 mt-1">Chọn loại sự kiện bạn muốn nhận thông báo.</p>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-dark-border">
        {TYPES.map((t) => (
          <li key={t.code} className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-900 dark:text-gray-200">{t.label}</span>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[t.code] ?? true}
                onChange={(e) => setPrefs((p) => ({ ...p, [t.code]: e.target.checked }))}
                className="h-4 w-4 rounded text-primary-600 focus:ring-primary-500"
                aria-label={`Bật/tắt ${t.label}`}
              />
            </label>
          </li>
        ))}
      </ul>
      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
    </div>
  );
}

function PrivacyTab() {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/users/me/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `competehub-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Đã tải dữ liệu của bạn');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể xuất dữ liệu'));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (confirm !== 'DELETE') {
      toast.error('Hãy nhập DELETE để xác nhận');
      return;
    }
    setDeleting(true);
    try {
      await api.delete('/users/me', { data: { password: pwd, confirm } });
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không thể xóa tài khoản'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
            <FileDown className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Xuất dữ liệu</h2>
            <p className="text-sm text-gray-500 mt-1">
              Tải toàn bộ dữ liệu liên quan đến tài khoản dưới dạng JSON (hồ sơ, bài nộp, thảo luận, vote, huy hiệu, audit log).
            </p>
          </div>
        </div>
        <button onClick={exportData} disabled={exporting} className="btn-primary">
          {exporting ? 'Đang chuẩn bị...' : 'Tải xuống'}
        </button>
      </section>

      <section className="border border-red-200 dark:border-red-900/50 rounded-xl p-5 bg-red-50/30 dark:bg-red-900/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Xóa tài khoản</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              Tài khoản sẽ bị anonymize (email/họ tên ẩn danh). Bài nộp và lịch sử xếp hạng vẫn được giữ để bảo
              toàn tính toàn vẹn của các cuộc thi đang chạy. Hành động này không thể hoàn tác.
            </p>
          </div>
        </div>
        <div className="space-y-2 max-w-md">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Mật khẩu hiện tại"
            className="input-field"
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder='Nhập "DELETE" để xác nhận'
            className="input-field font-mono"
          />
          <button
            onClick={deleteAccount}
            disabled={!pwd || confirm !== 'DELETE' || deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            {deleting ? 'Đang xóa...' : 'Xóa tài khoản vĩnh viễn'}
          </button>
        </div>
      </section>
    </div>
  );
}