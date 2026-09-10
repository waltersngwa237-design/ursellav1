import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string | null;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-zinc-300 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={`w-full bg-zinc-900 text-zinc-100 text-sm rounded-xl pl-3.5 pr-9 py-2.5 border transition-all appearance-none cursor-pointer focus:outline-none focus:ring-2 ${
              error
                ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20'
                : 'border-zinc-800 focus:border-emerald-500 focus:ring-emerald-500/20 hover:border-zinc-700'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100 py-1">
                {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-3 pointer-events-none text-zinc-400 flex items-center justify-center">
            <ChevronDown className="w-4 h-4 stroke-[1.75]" />
          </div>
        </div>
        {error ? (
          <p className="text-xs font-medium text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-zinc-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
