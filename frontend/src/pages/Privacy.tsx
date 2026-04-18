import { Shield, Database, Share2, FileDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
          <Shield className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Chính sách quyền riêng tư</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cập nhật lần cuối: <time dateTime="2026-04-18">18/04/2026</time>
          </p>
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary-600 hover:prose-a:text-primary-700">
        <p className="lead">
          CompeteHub tôn trọng quyền riêng tư của bạn. Tài liệu này giải thích chúng tôi thu thập dữ liệu gì,
          dùng vào việc gì, và bạn có thể kiểm soát ra sao.
        </p>

        <h2 className="flex items-center gap-2"><Database className="h-5 w-5" /> 1. Dữ liệu chúng tôi thu thập</h2>
        <ul>
          <li><strong>Thông tin tài khoản</strong>: email, họ tên, ảnh đại diện, liên kết OAuth (nếu dùng Google/GitHub).</li>
          <li><strong>Hoạt động</strong>: bài nộp, nội dung thảo luận, vote, kết quả bảng xếp hạng.</li>
          <li><strong>Kỹ thuật</strong>: địa chỉ IP, user agent, thời gian đăng nhập, audit log cho thao tác quản trị.</li>
        </ul>

        <h2>2. Mục đích sử dụng</h2>
        <ul>
          <li>Vận hành nền tảng và chấm điểm cuộc thi.</li>
          <li>Bảo mật tài khoản, phát hiện gian lận và brute-force.</li>
          <li>Cải thiện sản phẩm dựa trên số liệu tổng hợp (không định danh).</li>
        </ul>

        <h2 className="flex items-center gap-2"><Share2 className="h-5 w-5" /> 3. Chia sẻ dữ liệu</h2>
        <p>
          Chúng tôi <strong>không bán</strong> dữ liệu cho bên thứ ba. Dữ liệu chỉ được chia sẻ khi có yêu cầu
          pháp lý hợp lệ hoặc khi bạn cho phép tường minh.
        </p>

        <h2 className="flex items-center gap-2"><FileDown className="h-5 w-5" /> 4. Quyền của bạn (GDPR)</h2>
        <ul>
          <li>
            <strong>Xuất dữ liệu</strong>: vào <Link to="/settings">Cài đặt → Quyền riêng tư → Tải dữ liệu của
            tôi</Link> để tải toàn bộ dữ liệu dưới dạng JSON.
          </li>
          <li>
            <strong>Xóa tài khoản</strong>: anonymize email/tên của bạn, giữ lịch sử nộp bài để bảo toàn tính
            toàn vẹn của các cuộc thi đang chạy.
          </li>
          <li>
            <strong>Tuỳ chọn thông báo</strong>: bật/tắt từng loại thông báo qua <Link to="/settings">Cài đặt
            → Thông báo</Link>.
          </li>
        </ul>

        <h2>5. Bảo mật</h2>
        <ul>
          <li>Mật khẩu hash bằng bcrypt cost 12.</li>
          <li>Refresh token lưu dạng hash SHA-256 (không bao giờ lưu plaintext).</li>
          <li>TLS 1.2 + 1.3, HSTS, CSP nghiêm ngặt, sanitize HTML cho mọi nội dung người dùng.</li>
          <li>Quét virus ClamAV cho mọi tệp tải lên.</li>
        </ul>

        <h2>6. Liên hệ về quyền riêng tư</h2>
        <p>
          Mọi câu hỏi xin gửi về <a href="mailto:privacy@competehub.local">privacy@competehub.local</a>.
        </p>
      </div>
    </div>
  );
}