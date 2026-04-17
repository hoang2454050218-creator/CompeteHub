const COMPETITION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  ARCHIVED: 'Đã lưu trữ',
};

const COMPETITION_CATEGORY_LABELS: Record<string, string> = {
  FEATURED: 'Nổi bật',
  GETTING_STARTED: 'Nhập môn',
  RESEARCH: 'Nghiên cứu',
  COMMUNITY: 'Cộng đồng',
};

const EVALUATION_METRIC_LABELS: Record<string, string> = {
  ACCURACY: 'Độ chính xác',
  RMSE: 'RMSE',
  F1_SCORE: 'F1 Score',
  AUC_ROC: 'AUC-ROC',
  LOG_LOSS: 'Log Loss',
  CUSTOM: 'Tùy chỉnh',
};

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Đang chờ',
  SCORING: 'Đang chấm',
  SCORED: 'Đã chấm',
  FAILED: 'Chấm bài thất bại',
};

const USER_ROLE_LABELS: Record<string, string> = {
  PARTICIPANT: 'Người tham gia',
  HOST: 'Đơn vị tổ chức',
  ADMIN: 'Quản trị viên',
};

const API_ERROR_CODE_LABELS: Record<string, string> = {
  ACCOUNT_DEACTIVATED: 'Tài khoản đã bị vô hiệu hóa.',
  ACCOUNT_EXISTS: 'Email này đã tồn tại. Vui lòng đăng nhập bằng mật khẩu trước rồi liên kết tài khoản.',
  ACCOUNT_LOCKED: 'Tài khoản tạm thời bị khóa. Vui lòng thử lại sau.',
  ALREADY_IN_TEAM: 'Người dùng đã thuộc một đội trong cuộc thi này.',
  COMPETITION_ENDED: 'Cuộc thi hiện không mở để thao tác này.',
  CSRF_ERROR: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.',
  DAILY_LIMIT_EXCEEDED: 'Bạn đã đạt giới hạn số lượt nộp trong ngày.',
  DUPLICATE_ENTRY: 'Dữ liệu này đã tồn tại.',
  DUPLICATE_SUBMISSION: 'Tệp này đã được nộp trước đó.',
  EMAIL_EXISTS: 'Email này đã được sử dụng.',
  FILE_TOO_LARGE: 'Tệp vượt quá kích thước cho phép.',
  FK_VIOLATION: 'Dữ liệu tham chiếu không tồn tại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  IMMUTABLE_FIELD: 'Không thể thay đổi trường này khi cuộc thi đã bắt đầu.',
  INTERNAL_ERROR: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không chính xác.',
  INVALID_FILE_CONTENT: 'Nội dung tệp không khớp với phần mở rộng.',
  INVALID_FILE_TYPE: 'Định dạng tệp không hợp lệ.',
  INVALID_ID: 'Định dạng mã định danh không hợp lệ.',
  INVALID_TOKEN: 'Liên kết hoặc phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  MERGE_DEADLINE_PASSED: 'Đã quá hạn ghép đội.',
  MISSING_FILE: 'Vui lòng chọn tệp để tải lên.',
  NO_REFRESH_TOKEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  NOT_ENROLLED: 'Bạn cần tham gia cuộc thi trước khi thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  OAUTH_NOT_CONFIGURED: 'Máy chủ chưa cấu hình đăng nhập bằng nhà cung cấp này.',
  TOKEN_REUSE: 'Phiên đăng nhập không an toàn. Vui lòng đăng nhập lại.',
  TOTAL_LIMIT_EXCEEDED: 'Bạn đã đạt giới hạn tổng số lượt nộp.',
  TRANSACTION_CONFLICT: 'Hệ thống đang bận. Vui lòng thử lại.',
  UNAUTHORIZED: 'Vui lòng đăng nhập để tiếp tục.',
  VALIDATION_ERROR: 'Dữ liệu gửi lên không hợp lệ.',
};

type ApiMessageTranslation = {
  pattern: RegExp;
  format: (match: RegExpMatchArray) => string;
};

const API_MESSAGE_TRANSLATIONS: ApiMessageTranslation[] = [
  {
    pattern: /a record with this value already exists/i,
    format: () => 'Dữ liệu này đã tồn tại.',
  },
  {
    pattern: /account locked\. try again in (\d+) minutes/i,
    format: (match) => `Tài khoản tạm thời bị khóa. Vui lòng thử lại sau ${match[1]} phút.`,
  },
  {
    pattern: /cannot change "(.+)" after competition is active/i,
    format: (match) => `Không thể thay đổi trường "${match[1]}" khi cuộc thi đã bắt đầu.`,
  },
  {
    pattern: /cannot transition from (\w+) to (\w+)/i,
    format: (match) =>
      `Không thể chuyển trạng thái từ ${getCompetitionStatusLabel(match[1])} sang ${getCompetitionStatusLabel(match[2])}.`,
  },
  {
    pattern: /daily limit reached \((\d+)\)\. try again tomorrow\./i,
    format: (match) => `Bạn đã đạt giới hạn ${match[1]} lượt nộp trong ngày. Vui lòng thử lại vào ngày mai.`,
  },
  {
    pattern: /end date must be after start date/i,
    format: () => 'Ngày kết thúc phải sau ngày bắt đầu.',
  },
  {
    pattern: /file too large\. max: (\d+)mb/i,
    format: (match) => `Tệp vượt quá kích thước cho phép. Tối đa ${match[1]} MB.`,
  },
  {
    pattern: /if that email exists, a reset link has been sent/i,
    format: () => 'Nếu email tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu.',
  },
  {
    pattern: /invalid or expired authorization code/i,
    format: () => 'Mã xác thực không hợp lệ hoặc đã hết hạn.',
  },
  {
    pattern: /invalid refresh token/i,
    format: () => 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  },
  {
    pattern: /invalid data provided/i,
    format: () => 'Dữ liệu gửi lên không hợp lệ.',
  },
  {
    pattern: /logged out/i,
    format: () => 'Đăng xuất thành công.',
  },
  {
    pattern: /no refresh token provided/i,
    format: () => 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  },
  {
    pattern: /password reset successful/i,
    format: () => 'Đặt lại mật khẩu thành công.',
  },
  {
    pattern: /please set a public email on github before signing in\./i,
    format: () => 'Vui lòng thiết lập email công khai trên GitHub trước khi đăng nhập.',
  },
  {
    pattern: /record not found/i,
    format: () => 'Không tìm thấy dữ liệu yêu cầu.',
  },
  {
    pattern: /referenced record does not exist/i,
    format: () => 'Dữ liệu tham chiếu không tồn tại.',
  },
  {
    pattern: /registration successful/i,
    format: () => 'Tạo tài khoản thành công.',
  },
  {
    pattern: /token refreshed/i,
    format: () => 'Phiên đăng nhập đã được làm mới.',
  },
  {
    pattern: /transaction conflict, please retry/i,
    format: () => 'Hệ thống đang bận. Vui lòng thử lại.',
  },
  {
    pattern: /user not found/i,
    format: () => 'Không tìm thấy người dùng.',
  },
];

function fallbackLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function getCompetitionStatusLabel(status: string) {
  return COMPETITION_STATUS_LABELS[status] ?? fallbackLabel(status);
}

export function getCompetitionCategoryLabel(category: string) {
  return COMPETITION_CATEGORY_LABELS[category] ?? fallbackLabel(category);
}

export function getEvaluationMetricLabel(metric: string) {
  return EVALUATION_METRIC_LABELS[metric] ?? fallbackLabel(metric);
}

export function getSubmissionStatusLabel(status: string) {
  return SUBMISSION_STATUS_LABELS[status] ?? fallbackLabel(status);
}

export function getUserRoleLabel(role: string) {
  return USER_ROLE_LABELS[role] ?? fallbackLabel(role);
}

function translateServerMessage(message: string) {
  const translation = API_MESSAGE_TRANSLATIONS.find(({ pattern }) => pattern.test(message));
  if (!translation) {
    return message;
  }

  const match = message.match(translation.pattern);
  return match ? translation.format(match) : message;
}

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
  overrides: Record<string, string> = {}
) {
  const responseData = (
    error as { response?: { data?: { message?: string; errorCode?: string } } } | undefined
  )?.response?.data;

  const errorCode = responseData?.errorCode;
  const serverMessage = responseData?.message;

  if (errorCode && overrides[errorCode]) {
    return overrides[errorCode];
  }

  if (errorCode && API_ERROR_CODE_LABELS[errorCode]) {
    return API_ERROR_CODE_LABELS[errorCode];
  }

  if (serverMessage) {
    return translateServerMessage(serverMessage);
  }

  return fallback;
}