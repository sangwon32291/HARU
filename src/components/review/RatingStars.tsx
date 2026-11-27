import { Star } from 'lucide-react';
import { cn } from '@/lib/format';

export function RatingStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`5점 만점에 ${value.toFixed(1)}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn(n <= Math.round(value) ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-haru-border')}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function RatingInput({
  value,
  onChange,
  label,
  description,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-haru-border bg-white px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="mt-1 text-xs text-haru-sub">{description}</p>}
      </div>
      <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}점`}
            onClick={() => onChange(n)}
            className="rounded p-0.5"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-transform hover:scale-110',
                n <= value ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-haru-border',
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}
