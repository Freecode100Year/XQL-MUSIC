// Query parameters shared by the Pages Functions. A value that is missing or
// not a plain whole number falls back to the default, then is kept in range,
// so nothing like NaN or -5 is ever passed upstream.
export function intParam(value: string | null, fallback: number, min: number, max: number): number {
  const text = (value ?? '').trim();
  const n = /^\d{1,9}$/.test(text) ? Number(text) : fallback;
  return Math.min(max, Math.max(min, n));
}

export const MAX_PAGE = 500;
export const MAX_KEYWORD = 100;
