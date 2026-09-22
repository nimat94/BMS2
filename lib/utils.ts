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
