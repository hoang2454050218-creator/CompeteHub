import { z, ZodErrorMap, ZodIssueCode } from 'zod';

const zodErrorMap: ZodErrorMap = (issue, ctx) => {
  if (issue.message) {
    return { message: issue.message };
  }

  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') {
        return { message: 'Trường này là bắt buộc' };
      }
      return { message: 'Kiểu dữ liệu không hợp lệ' };

    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: 'Địa chỉ email không hợp lệ' };
      }
      if (issue.validation === 'url') {
        return { message: 'Liên kết không hợp lệ' };
      }
      if (issue.validation === 'uuid') {
        return { message: 'Mã định danh không hợp lệ' };
      }
      if (issue.validation === 'datetime') {
        return { message: 'Ngày giờ không hợp lệ' };
      }
      if (issue.validation === 'regex') {
        return { message: 'Giá trị không đúng định dạng yêu cầu' };
      }
      return { message: 'Chuỗi không hợp lệ' };

    case ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: `Cần ít nhất ${issue.minimum} ký tự` };
      }
      if (issue.type === 'array') {
        return { message: `Cần ít nhất ${issue.minimum} mục` };
      }
      if (issue.type === 'number') {
        return {
          message: issue.inclusive
            ? `Giá trị phải lớn hơn hoặc bằng ${issue.minimum}`
            : `Giá trị phải lớn hơn ${issue.minimum}`,
        };
      }
      return { message: 'Giá trị quá nhỏ' };

    case ZodIssueCode.too_big:
      if (issue.type === 'string') {
        return { message: `Tối đa ${issue.maximum} ký tự` };
      }
      if (issue.type === 'array') {
        return { message: `Tối đa ${issue.maximum} mục` };
      }
      if (issue.type === 'number') {
        return {
          message: issue.inclusive
            ? `Giá trị phải nhỏ hơn hoặc bằng ${issue.maximum}`
            : `Giá trị phải nhỏ hơn ${issue.maximum}`,
        };
      }
      return { message: 'Giá trị quá lớn' };

    case ZodIssueCode.invalid_enum_value:
      return { message: 'Giá trị không nằm trong danh sách cho phép' };

    case ZodIssueCode.invalid_literal:
      return { message: 'Giá trị không hợp lệ' };

    case ZodIssueCode.invalid_union:
      return { message: 'Giá trị không hợp lệ' };

    case ZodIssueCode.invalid_date:
      return { message: 'Ngày không hợp lệ' };

    case ZodIssueCode.unrecognized_keys:
      return { message: `Trường không được hỗ trợ: ${issue.keys.join(', ')}` };

    default:
      return { message: ctx.defaultError === 'Required' ? 'Trường này là bắt buộc' : 'Dữ liệu không hợp lệ' };
  }
};

export function initZodErrorMap() {
  z.setErrorMap(zodErrorMap);
}
