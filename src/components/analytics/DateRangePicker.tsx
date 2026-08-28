import React from 'react';
import type { DateRangePreset } from '../../types/index.ts';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  activePreset: DateRangePreset;
  onSelectPreset: (preset: DateRangePreset) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
  windowLabel?: string;
  priorLabel?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  activePreset,
  onSelectPreset,
  customStart,
  customEnd,
  onCustomChange,
  windowLabel,
  priorLabel,
}) => {
  const [showCustom, setShowCustom] = React.useState(activePreset === 'custom');
  const [startInput, setStartInput] = React.useState(
    customStart || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [endInput, setEndInput] = React.useState(
    customEnd || new Date().toISOString().split('T')[0]
  );

  const presets: Array<{ id: DateRangePreset; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'last_7_days', label: '7 Days' },
    { id: 'last_30_days', label: '30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_year', label: 'This Year' },
    { id: 'custom', label: 'Custom' },
  ];

  const handleApplyCustom = () => {
    if (onCustomChange && startInput && endInput) {
      onCustomChange(
        new Date(startInput).toISOString(),
        new Date(`${endInput}T23:59:59.999Z`).toISOString()
      );
      onSelectPreset('custom');
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Preset Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {presets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelectPreset(p.id);
                if (p.id === 'custom') setShowCustom(true);
                else setShowCustom(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm font-bold'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800/80'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Inputs Dropdown */}
      {showCustom && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">From:</span>
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">To:</span>
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Comparison Reference Context */}
      {windowLabel && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span>
            Viewing: <strong className="text-zinc-300">{windowLabel}</strong>
            {priorLabel && (
              <>
                {' '}
                • Compared to: <span className="text-zinc-400">{priorLabel}</span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
};
