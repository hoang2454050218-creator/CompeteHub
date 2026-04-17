import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trophy, ArrowRight, Zap, Shield, Globe } from 'lucide-react';
import api from '../services/api';
import { Competition } from '../types';
import CompetitionCard from '../components/CompetitionCard';
import { PageLoader } from '../components/LoadingSpinner';

export default function Home() {
  const { data: featured, isLoading, isError } = useQuery({
    queryKey: ['competitions', 'featured'],
    queryFn: () => api.get('/competitions?status=ACTIVE&sort=newest&limit=6').then((r) => r.data.data as Competition[]),
  });

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="max-w-3xl">
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-6 leading-tight">
              Thi đấu. Học hỏi.
              <span className="block text-primary-200">Bứt phá.</span>
            </h1>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl">
              Tham gia các cuộc thi khoa học dữ liệu, xây dựng mô hình hiện đại và khẳng định năng lực qua các bài toán thực tế.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/competitions" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-colors">
                Khám phá cuộc thi <ArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500/30 text-white font-semibold rounded-lg border border-primary-400/50 hover:bg-primary-500/40 transition-colors">
                Bắt đầu ngay
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: 'Chấm điểm tự động',
              desc: 'Nộp kết quả dự đoán và nhận điểm nhanh chóng với nhiều chỉ số đánh giá như Accuracy, RMSE, F1 Score và AUC-ROC.',
            },
            {
              icon: Shield,
              title: 'Thi đấu công bằng',
              desc: 'Bảng xếp hạng công khai và riêng tư giúp hạn chế overfitting. Kết quả cuối cùng được công bố khi cuộc thi kết thúc.',
            },
            {
              icon: Globe,
              title: 'Cập nhật thời gian thực',
              desc: 'Bảng xếp hạng được cập nhật trực tiếp qua WebSocket để bạn theo dõi thứ hạng ngay khi có bài nộp mới.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
              <p className="text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cuộc thi đang diễn ra</h2>
          <Link to="/competitions" className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            Xem tất cả <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isError ? (
          <div className="card p-12 text-center">
            <h3 className="text-lg font-medium text-red-600 mb-2">Không thể tải danh sách cuộc thi</h3>
            <p className="text-gray-500">Vui lòng thử lại sau.</p>
          </div>
        ) : isLoading ? (
          <PageLoader />
        ) : featured?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Chưa có cuộc thi nào đang diễn ra</h3>
            <p className="text-gray-500">Hãy quay lại sau hoặc tạo cuộc thi của riêng bạn.</p>
          </div>
        )}
      </section>
    </div>
  );
}
