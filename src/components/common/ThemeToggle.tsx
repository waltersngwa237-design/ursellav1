import React from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'icon' | 'button' | 'dropdown-item';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme();

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isDark
            ? 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
        } ${className}`}
        aria-label="Toggle light and dark mode"
      >
        <div className="flex items-center gap-2.5">
          {isDark ? (
            <Moon className="w-4 h-4 text-indigo-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
          <span>Appearance</span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-700/40 text-zinc-300">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      </button>
    );
  }

  if (variant === 'dropdown-item') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left ${
          isDark
            ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        } ${className}`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
        )}
        <span>Switch to {isDark ? 'Light' : 'Dark'} Mode</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-700/60 active:scale-95 ${className}`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-500" />
      )}
    </button>
  );
};
