// Российский номер в любом виде («8 916 123-45-67», «+7(916)1234567», «9161234567») → «+79161234567».
// null — если это не похоже на номер.
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10 && d.startsWith('9')) d = '7' + d;
  if (d.length === 11 && d.startsWith('7')) return '+' + d;
  return null;
}

// «+79161234567» → «+7 916 123-45-67»
export function formatPhone(p: string | null | undefined): string {
  const n = normalizePhone(p || '');
  if (!n) return p || '';
  const d = n.slice(2);
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

export function looksLikeEmail(s: string): boolean {
  return s.includes('@');
}
