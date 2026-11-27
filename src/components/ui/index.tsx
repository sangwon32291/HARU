/**
 * 공통 UI 프리미티브.
 * 버튼·입력·배지·모달·상태 화면(로딩/오류/빈 목록/로그인 필요)을 한곳에서 정의해
 * 4명이 각자 화면을 만들어도 디자인이 어긋나지 않게 한다.
 */
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Inbox, Loader2, LogIn, X } from 'lucide-react';
import { cn } from '@/lib/format';

/* ───────── Button ───────── */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-haru-primary text-white hover:bg-haru-primary-dark active:bg-haru-primary-dark',
  secondary: 'bg-haru-secondary text-haru-primary-dark hover:bg-[#d9eee1]',
  outline: 'border border-haru-border bg-white text-haru-text hover:bg-haru-bg',
  ghost: 'text-haru-sub hover:bg-haru-secondary hover:text-haru-primary-dark',
  danger: 'bg-white text-haru-danger border border-haru-danger/30 hover:bg-haru-danger/5',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-13 px-5 text-base rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        fullWidth && 'w-full',
        size === 'lg' && 'h-[52px]',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/* ───────── Form ───────── */

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, hint, error, required, children, htmlFor }: FieldProps) {
  return (
    <div>
      {label && (
        <label className="haru-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-haru-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-haru-danger">{error}</p>
      ) : hint ? (
        <p className="haru-hint">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full rounded-xl border border-haru-border bg-white px-3 text-sm text-haru-text placeholder:text-haru-sub/70 focus:border-haru-primary focus:outline-none focus:ring-2 focus:ring-haru-primary/20 disabled:bg-haru-bg';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(CONTROL, 'h-11', className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(CONTROL, 'min-h-[120px] py-3 leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(CONTROL, 'h-11 appearance-none bg-no-repeat pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B756D' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 12px center',
      }}
    >
      {children}
    </select>
  );
}

/* ───────── Badge ───────── */

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-haru-bg text-haru-sub border border-haru-border',
  primary: 'bg-haru-secondary text-haru-primary-dark',
  success: 'bg-[#E6F4EA] text-[#1E7A45]',
  warn: 'bg-[#FDF3E3] text-haru-warn',
  danger: 'bg-[#FCEBEB] text-haru-danger',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('haru-chip', BADGE_TONE[tone], className)}>{children}</span>;
}

/* ───────── 상태 화면 ───────── */

export function Spinner({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-haru-sub" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-haru-primary" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="haru-card h-[116px] animate-pulse p-4">
          <div className="h-4 w-2/3 rounded bg-haru-border" />
          <div className="mt-3 h-3 w-1/3 rounded bg-haru-border/70" />
          <div className="mt-5 h-3 w-1/2 rounded bg-haru-border/70" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-haru-border bg-white/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-haru-secondary text-haru-primary">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden />}
      </div>
      <p className="text-sm font-semibold text-haru-text">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm leading-relaxed text-haru-sub">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-haru-danger/20 bg-[#FCEBEB]/40 px-6 py-10 text-center">
      <AlertCircle className="mb-3 h-6 w-6 text-haru-danger" aria-hidden />
      <p className="text-sm font-medium text-haru-text">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}

export function LoginRequired({ message = '이 기능은 로그인 후 이용할 수 있습니다.', redirectTo }: { message?: string; redirectTo?: string }) {
  const to = redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login';
  return (
    <EmptyState
      icon={<LogIn className="h-6 w-6" aria-hidden />}
      title="로그인이 필요합니다"
      description={message}
      action={
        <Link to={to}>
          <Button size="md">로그인하러 가기</Button>
        </Link>
      }
    />
  );
}

/* ───────── Modal ───────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md animate-fade-up rounded-t-2xl bg-white p-5 shadow-float sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1 text-haru-sub hover:bg-haru-bg"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">{children}</div>
        {footer && <div className="mt-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────── Tabs ───────── */

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (next: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-haru-primary bg-haru-primary text-white'
                : 'border-haru-border bg-white text-haru-sub hover:border-haru-primary/40',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn('ml-1 text-xs', active ? 'text-white/80' : 'text-haru-sub/70')}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Section ───────── */

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-haru-sub">{description}</p>}
      </div>
      {action}
    </div>
  );
}
