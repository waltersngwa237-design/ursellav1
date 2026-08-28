import React, { useState } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { CURRENCY_MAP, type SupportedCurrency } from '../../types/index.ts';
import { ChevronDown, Plus, Check, Store, Building2 } from 'lucide-react';
import { Badge } from '../common/Badge.tsx';

interface BusinessSwitcherProps {
  onOpenNewBusinessModal: () => void;
}

export const BusinessSwitcher: React.FC<BusinessSwitcherProps> = ({ onOpenNewBusinessModal }) => {
  const { businesses, activeBusiness, activeRole, setActiveBusinessId } = useBusiness();
  const [isOpen, setIsOpen] = useState(false);

  const activeCurrency = (activeBusiness?.currency || 'XAF') as SupportedCurrency;
  const currencyInfo = CURRENCY_MAP[activeCurrency] || CURRENCY_MAP.XAF;

  const roleVariantMap = {
    owner: 'emerald' as const,
    admin: 'blue' as const,
    staff: 'zinc' as const,
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/80 border border-zinc-800 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-zinc-100 truncate block">
                {activeBusiness?.name || 'Select Business'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {activeRole && (
                <Badge variant={roleVariantMap[activeRole]} size="sm">
                  {activeRole.toUpperCase()}
                </Badge>
              )}
              <span className="text-[11px] text-zinc-400">
                {currencyInfo.symbol}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 shadow-xl shadow-zinc-950/80 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Your Businesses ({businesses.length})
            </div>

            <div className="space-y-1">
              {businesses.map((item) => {
                const isSelected = item.business.id === activeBusiness?.id;
                const bizCurrency = (item.business.currency || 'XAF') as SupportedCurrency;
                const bizCurrencyInfo = CURRENCY_MAP[bizCurrency] || CURRENCY_MAP.XAF;

                return (
                  <button
                    key={item.business.id}
                    onClick={() => {
                      setActiveBusinessId(item.business.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-white'
                        : 'hover:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-zinc-100">
                          {item.business.name}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {item.role.toUpperCase()} • {bizCurrencyInfo.code}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-1 pt-1 border-t border-zinc-800">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewBusinessModal();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Register Another Business</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
