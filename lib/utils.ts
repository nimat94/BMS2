export function fmtNum(n: number | null | undefined): string {
  return (Math.round((n || 0) * 10) / 10).toLocaleString('ru-RU');
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}.${m}.${y.slice(2)}`;
}

export function monthKey(d: string): string {
  return d.slice(0, 7);
}

export function statusClass(v: string): string {
  if (v === 'Да') return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700';
  if (v === 'Частично') return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700';
  return 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700';
}

export function nextStatus(cur: string): string {
  if (cur === 'Нет') return 'Да';
  if (cur === 'Да') return 'Частично';
  return 'Нет';
}

// Correct month range: [first day of month, first day of NEXT month).
// Use with .gte(from).lt(to) — avoids invalid dates like 2026-09-31.
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const to = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { from, to };
}
