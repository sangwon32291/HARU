import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/format';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    seq += 1;
    const id = seq;
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-8"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-float',
              item.tone === 'success' && 'bg-haru-primary text-white',
              item.tone === 'error' && 'bg-haru-danger text-white',
              item.tone === 'info' && 'bg-haru-text text-white',
            )}
          >
            {item.tone === 'success' && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" aria-hidden />}
            {item.tone === 'error' && <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />}
            {item.tone === 'info' && <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden />}
            <span className="leading-relaxed">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast는 ToastProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
