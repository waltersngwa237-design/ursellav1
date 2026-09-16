import React, { useState } from 'react';
import type { AppNavRoute } from '../../types/index.ts';
import {
  Plus,
  ShoppingCart,
  Package,
  Receipt,
  UserPlus,
  X,
  Sparkles,
} from 'lucide-react';

interface FloatingActionButtonProps {
  onNavigate: (route: AppNavRoute) => void;
  currentRoute?: AppNavRoute;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onNavigate,
  currentRoute,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Hide the floating action button completely on the AI Advisor tab
  if (currentRoute === 'ai') {
    return null;
  }

  const actions = [
    {
      label: 'New Sale (POS)',
      description: 'Checkout customer',
      route: 'sell' as AppNavRoute,
      icon: <ShoppingCart className="w-5 h-5 text-emerald-400" />,
      bg: 'bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25',
    },
    {
      label: 'Add Product',
      description: 'Stock & inventory',
      route: 'business' as AppNavRoute,
      icon: <Package className="w-5 h-5 text-blue-400" />,
      bg: 'bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25',
    },
    {
      label: 'Add Expense',
      description: 'Track outgoing cash',
      route: 'expenses' as AppNavRoute,
      icon: <Receipt className="w-5 h-5 text-amber-400" />,
      bg: 'bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25',
    },
    {
      label: 'New Customer',
      description: 'Add debt or contact',
      route: 'customers' as AppNavRoute,
      icon: <UserPlus className="w-5 h-5 text-purple-400" />,
      bg: 'bg-purple-500/15 border-purple-500/30 hover:bg-purple-500/25',
    },
  ];

  const handleSelect = (route: AppNavRoute) => {
    setIsOpen(false);
    onNavigate(route);
  };

  return (
    <>
      {/* Backdrop overlay when speed-dial is expanded */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Speed Dial Container: Displayed cleanly on desktop view where there is no bottom bar */}
      <div
        className="hidden md:flex fixed z-40 flex-col items-end gap-2.5 right-6 bottom-7 transition-all duration-200"
      >
        {/* Expanded Quick Action Items */}
        {isOpen && (
          <div className="flex flex-col items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(action.route)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-zinc-900/95 border text-left shadow-xl hover:scale-105 active:scale-95 transition-all group ${action.bg}`}
              >
                <div className="text-right">
                  <div className="text-xs font-bold text-zinc-100 group-hover:text-white">
                    {action.label}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {action.description}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-zinc-800/80 shrink-0">
                  {action.icon}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Master Floating Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Quick Business Actions"
          className={`relative group flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full shadow-2xl transition-all duration-300 active:scale-95 ${
            isOpen
              ? 'bg-zinc-800 text-zinc-200 rotate-90 border border-zinc-700'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 hover:shadow-emerald-500/25 hover:scale-105 ring-4 ring-emerald-500/20 border border-emerald-400/30'
          }`}
        >
          {isOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <>
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-90 duration-300" />
              <span className="sr-only">Quick Action</span>
            </>
          )}
        </button>
      </div>
    </>
  );
};
