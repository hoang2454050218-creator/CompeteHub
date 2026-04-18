import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CookiePolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
          <Cookie className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Chính sách Cookie</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cập nhật lần cuối: <time dateTime="2026-04-18">18/04/2026</time>
          </p>
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none prose-a:text-primary-600 hover:prose-a:text-primary-700">
        <p className="lead">
          CompeteHub chỉ dùng cookie và localStorage tối thiểu để duy trì phiên đăng nhập và tuỳ chọn giao diện.
          Chúng tôi <strong>không</strong> dùng cookie quảng cáo hoặc analytics bên thứ ba.
        </p>

        <h2>Cookie và lưu trữ chúng tôi sử dụng</h2>
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Loại</th>
              <th>Mục đích</th>
              <th>Thời hạn</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>refreshToken</code></td>
              <td>Cookie HttpOnly · Secure · SameSite=Strict · Path=<code>/api/v1/auth/refresh</code></td>
              <td>Duy trì phiên đăng nhập</td>
              <td>7 ngày</td>
            </tr>
            <tr>
              <td><code>theme</code></td>
              <td>localStorage</td>
              <td>Tuỳ chọn giao diện sáng/tối</td>
              <td>Vĩnh viễn cho đến khi xóa</td>
            </tr>
            <tr>
              <td><code>cookieConsent</code></td>
              <td>localStorage</td>
              <td>Lưu lựa chọn banner cookie</td>
              <td>Vĩnh viễn cho đến khi xóa</td>
            </tr>
          </tbody>
        </table>

        <h2>Cookie bên thứ ba</h2>
        <p>Không có. Mọi tài nguyên tĩnh đều phục vụ từ chính nền tảng hoặc CDN không tracking.</p>

        <h2>Tắt cookie</h2>
        <p>
          Tắt cookie <code>refreshToken</code> sẽ khiến bạn không đăng nhập được. Cookie tuỳ chọn có thể xóa qua
          công cụ &quot;Xóa dữ liệu trang&quot; trên trình duyệt mà không ảnh hưởng đến tính năng.
        </p>

        <h2>Chi tiết khác</h2>
        <p>
          Để biết toàn bộ dữ liệu chúng tôi xử lý, xem <Link to="/privacy">Quyền riêng tư</Link>.
        </p>
      </div>
    </div>
  );
}