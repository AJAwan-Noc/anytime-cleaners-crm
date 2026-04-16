import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
};

export default function StarRating({ value, onChange, size = 'md', readonly = false }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        return (
          <button
            key={n}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(n)}
            onMouseEnter={() => !readonly && setHover(n)}
            onMouseLeave={() => !readonly && setHover(0)}
            className={cn(
              'transition-transform',
              !readonly && 'hover:scale-110 cursor-pointer',
              readonly && 'cursor-default',
            )}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                sizeMap[size],
                filled ? 'fill-indigo-500 text-indigo-500' : 'fill-none text-muted-foreground/40',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
