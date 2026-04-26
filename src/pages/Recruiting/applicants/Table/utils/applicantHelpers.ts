export const normalizeGender = (raw: any) => {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  const arabicMale = ['ذكر', 'ذكرً', 'ذَكر'];
  const arabicFemale = ['انثى', 'أنثى', 'انثي', 'انسه', 'أنسه', 'انثا'];
  if (arabicMale.includes(s) || arabicMale.includes(lower)) return 'Male';
  if (arabicFemale.includes(s) || arabicFemale.includes(lower)) return 'Female';
  if (lower === 'male' || lower === 'm') return 'Male';
  if (lower === 'female' || lower === 'f') return 'Female';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const extractId = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = extractId(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === 'object') {
    const maybeId = value as { _id?: unknown; id?: unknown };
    if (typeof maybeId._id === 'string' && maybeId._id.trim()) return maybeId._id.trim();
    if (typeof maybeId.id === 'string' && maybeId.id.trim()) return maybeId.id.trim();
  }
  return null;
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};