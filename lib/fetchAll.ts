// Supabase отдаёт не больше 1000 строк за запрос — забираем порциями, пока не кончатся.
// build() должен каждый раз возвращать НОВЫЙ запрос (select/eq/order…), без .range().
export async function fetchAll<T = any>(build: () => any, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const chunk = (data || []) as T[];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return out;
}
