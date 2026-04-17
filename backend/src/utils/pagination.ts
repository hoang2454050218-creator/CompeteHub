// AUDIT-FIX: Cap pagination to prevent abuse
export function parsePagination(query: Record<string, unknown>, defaults = { page: 1, limit: 20, maxLimit: 100 }) {
  const page = Math.max(1, parseInt(String(query.page)) || defaults.page);
  const limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(String(query.limit)) || defaults.limit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
