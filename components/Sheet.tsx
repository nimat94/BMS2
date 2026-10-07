'use client';
import { useEffect, useRef } from 'react';

// Окно-форма. На телефоне выезжает снизу на всю ширину (ближе к большому пальцу),
// на компьютере — обычное окно по центру.
export default function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode; // кнопка «Сохранить» — всегда видна внизу
}) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    // пока открыто окно, страница под ним не прокручивается
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45 anim-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="anim-sheet relative bg-white dark:bg-slate-900 w-full sm:w-[min(460px,92vw)] max-h-[92dvh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="flex items-center justify-between gap-2 pl-4 pr-1 py-1.5 sm:py-2 border-b border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-sm leading-tight">{title}</span>
          <button onClick={onClose} aria-label="Закрыть" className="shrink-0 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center text-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✕</button>
        </div>
        <div className="p-4 overflow-auto overscroll-contain flex-1">{children}</div>
        {footer && (
          <div className="px-4 pt-2 pb-3 border-t border-slate-200 dark:border-slate-800 pb-safe">
            <div className="pb-1">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
