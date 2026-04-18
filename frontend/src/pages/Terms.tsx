import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
          <Trophy className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Điều khoản sử dụng</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cập nhật lần cuối: <time dateTime="2026-04-18">18/04/2026</time>
          </p>
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary-600 hover:prose-a:text-primary-700">
        <p className="lead">
          Cảm ơn bạn đã chọn CompeteHub. Tài liệu này mô tả các điều khoản áp dụng khi bạn truy cập, đăng ký, hoặc
          sử dụng bất kỳ tính năng nào của nền tảng.
        </p>

        <h2>1. Chấp thuận điều khoản</h2>
        <p>
          Khi truy cập CompeteHub, bạn đồng ý tuân thủ các điều khoản trong tài liệu này và các chính sách liên
          quan (Quyền riêng tư, Cookie). Nếu không đồng ý, vui lòng ngừng sử dụng nền tảng.
        </p>

        <h2>2. Tài khoản người dùng</h2>
        <ul>
          <li>Bạn chịu trách nhiệm giữ bí mật thông tin đăng nhập và mọi hoạt động trên tài khoản của mình.</li>
          <li>Khuyến khích bật xác thực 2 yếu tố (MFA) trong <Link to="/settings">Cài đặt → Bảo mật</Link>.</li>
          <li>Vui lòng báo cáo ngay khi nghi ngờ có truy cập trái phép.</li>
        </ul>

        <h2>3. Quy tắc tham gia cuộc thi</h2>
        <ul>
          <li>Không gian lận, không chia sẻ ground truth, không nộp bài thay người khác.</li>
          <li>Mỗi người dùng chỉ được sử dụng một tài khoản chính.</li>
          <li>Tuân thủ quy định riêng của từng cuộc thi do đơn vị tổ chức công bố.</li>
          <li>Kết quả chấm điểm tự động là quyết định cuối cùng. Khiếu nại gửi về cho host trong vòng 7 ngày.</li>
        </ul>

        <h2>4. Sở hữu trí tuệ</h2>
        <p>
          Mã nguồn, dữ liệu, và mô hình bạn tải lên vẫn thuộc sở hữu của bạn. CompeteHub chỉ sử dụng nội dung đó
          để vận hành nền tảng (lưu trữ, chấm điểm, hiển thị trên bảng xếp hạng).
        </p>

        <h2>5. Chấm dứt</h2>
        <p>
          Chúng tôi có quyền tạm khóa hoặc xóa tài khoản vi phạm điều khoản này, gian lận, hoặc gây hại cho người
          dùng khác. Trước khi xóa, bạn sẽ nhận email cảnh báo trừ các vi phạm nghiêm trọng.
        </p>

        <h2>6. Liên hệ</h2>
        <p>
          Mọi thắc mắc xin gửi về <a href="mailto:support@competehub.local">support@competehub.local</a>. Câu hỏi
          liên quan đến dữ liệu cá nhân, xem thêm <Link to="/privacy">Quyền riêng tư</Link>.
        </p>
      </div>
    </div>
  );
}