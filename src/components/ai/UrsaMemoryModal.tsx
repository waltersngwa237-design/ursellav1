import React, { useState, useEffect } from 'react';
import {
  Brain,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Pin,
  Sparkles,
  Bookmark,
  Target,
  Truck,
  ShieldCheck,
  FileText,
  HelpCircle,
} from 'lucide-react';
import type { UrsaMemoryFact, UrsaMemoryCategory } from '../../types/ai.ts';
import { UrsaMemoryService } from '../../services/ursa-memory.service.ts';

interface UrsaMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  language?: 'en' | 'fr';
  isDark?: boolean;
  onMemoriesUpdated?: () => void;
}

export const UrsaMemoryModal: React.FC<UrsaMemoryModalProps> = ({
  isOpen,
  onClose,
  businessId,
  language = 'en',
  isDark = true,
  onMemoriesUpdated,
}) => {
  const isFr = language === 'fr';
  const [memories, setMemories] = useState<UrsaMemoryFact[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<UrsaMemoryCategory>('business_rule');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && businessId) {
      loadMemories();
    }
  }, [isOpen, businessId]);

  const loadMemories = () => {
    const list = UrsaMemoryService.getMemories(businessId);
    setMemories(list);
    if (onMemoriesUpdated) onMemoriesUpdated();
  };

  if (!isOpen) return null;

  const handleSaveMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || !contentInput.trim() || !businessId) return;

    if (editingId) {
      UrsaMemoryService.updateMemory(businessId, editingId, {
        key: keyInput,
        content: contentInput,
        category: categoryInput,
      });
      setEditingId(null);
    } else {
      UrsaMemoryService.addMemory(businessId, {
        key: keyInput,
        content: contentInput,
        category: categoryInput,
        source: 'user_pinned',
      });
    }

    setKeyInput('');
    setContentInput('');
    setCategoryInput('business_rule');
    setIsAdding(false);
    loadMemories();
  };

  const handleEditClick = (mem: UrsaMemoryFact) => {
    setEditingId(mem.id);
    setKeyInput(mem.key);
    setContentInput(mem.content);
    setCategoryInput(mem.category);
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (!businessId) return;
    UrsaMemoryService.deleteMemory(businessId, id);
    loadMemories();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const categories: Array<{ id: string; label: string; labelFr: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'All Facts', labelFr: 'Tout', icon: <Brain className="w-3.5 h-3.5" /> },
    { id: 'business_rule', label: 'Rules & Policies', labelFr: 'Règles', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'supplier', label: 'Suppliers', labelFr: 'Fournisseurs', icon: <Truck className="w-3.5 h-3.5" /> },
    { id: 'target', label: 'Targets & Goals', labelFr: 'Objectifs', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'preference', label: 'Preferences', labelFr: 'Préférences', icon: <Bookmark className="w-3.5 h-3.5" /> },
    { id: 'note', label: 'Notes', labelFr: 'Notes', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  const filteredMemories = memories.filter((m) => {
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || m.key.toLowerCase().includes(q) || m.content.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const getCategoryBadge = (cat: UrsaMemoryCategory) => {
    switch (cat) {
      case 'supplier':
        return { label: isFr ? 'Fournisseur' : 'Supplier', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'target':
        return { label: isFr ? 'Objectif' : 'Target', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'business_rule':
        return { label: isFr ? 'Règle' : 'Rule', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
      case 'preference':
        return { label: isFr ? 'Préférence' : 'Preference', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      default:
        return { label: isFr ? 'Note' : 'Note', color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${isDark ? 'border-zinc-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {isFr ? "Mémoire Long Terme d'Ursa" : "Ursa Memory Bank"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {memories.length} {isFr ? 'Faits' : 'Facts'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {isFr
                  ? "Ursa utilise ces informations enregistrées pour personnaliser ses conseils et analyses."
                  : "Ursa recalls these saved rules, delivery days, and targets across all conversations."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div className={`p-3 sm:p-4 space-y-3 border-b ${isDark ? 'border-zinc-800/80 bg-zinc-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-2.5 w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder={isFr ? "Rechercher dans la mémoire..." : "Search stored facts..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl text-xs transition-colors focus:outline-none border ${
                  isDark
                    ? 'bg-zinc-800/80 border-zinc-700/80 text-white placeholder-zinc-500 focus:border-indigo-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                }`}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setIsAdding(!isAdding);
                if (editingId) {
                  setEditingId(null);
                  setKeyInput('');
                  setContentInput('');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFr ? 'Ajouter' : 'Pin Fact'}</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {cat.icon}
                  <span>{isFr ? cat.labelFr : cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add/Edit Form Drawer */}
        {isAdding && (
          <form
            onSubmit={handleSaveMemory}
            className={`p-4 border-b space-y-3 animate-slide-down ${
              isDark ? 'bg-zinc-800/40 border-zinc-700/80' : 'bg-slate-100/70 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5 text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                {editingId ? (isFr ? 'Modifier la connaissance' : 'Edit Stored Memory') : (isFr ? 'Nouveau fait à retenir' : 'Pin New Business Memory')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setKeyInput('');
                  setContentInput('');
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {isFr ? 'Annuler' : 'Cancel'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {isFr ? 'Catégorie' : 'Category'}
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value as UrsaMemoryCategory)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white focus:border-indigo-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                  }`}
                >
                  <option value="business_rule">{isFr ? 'Règle Commerciale' : 'Business Rule'}</option>
                  <option value="supplier">{isFr ? 'Fournisseur' : 'Supplier Details'}</option>
                  <option value="target">{isFr ? 'Objectif Financier' : 'Target & Goal'}</option>
                  <option value="preference">{isFr ? 'Préférence' : 'Preference'}</option>
                  <option value="note">{isFr ? 'Note Générale' : 'General Note'}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  {isFr ? 'Sujet / Titre' : 'Topic / Key Title'}
                </label>
                <input
                  type="text"
                  placeholder={isFr ? "ex: Jours de livraison boissons" : "e.g., Dairy Supplier Delivery Schedule"}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  required
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-indigo-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                {isFr ? 'Information / Règle exacte' : 'Factual Detail for Ursa to Remember'}
              </label>
              <textarea
                rows={2}
                placeholder={
                  isFr
                    ? "ex: Le fournisseur ABC livre les mardis matin à 8h. Le réapprovisionnement minimum est de 15 caisses."
                    : "e.g., Supplier delivers every Tuesday morning. Minimum order is 15 cases. Always aim for a 30% gross margin on beverages."
                }
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                required
                className={`w-full px-2.5 py-1.5 rounded-lg text-xs border ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-indigo-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                }`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              >
                {editingId ? (isFr ? 'Enregistrer les modifications' : 'Update Memory') : (isFr ? 'Enregistrer dans la mémoire' : 'Save Memory')}
              </button>
            </div>
          </form>
        )}

        {/* Memory Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredMemories.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-500">
                <Brain className="w-6 h-6 text-zinc-600" />
              </div>
              <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {searchQuery
                  ? isFr
                    ? 'Aucun fait ne correspond à votre recherche.'
                    : 'No memory facts found matching your search query.'
                  : isFr
                  ? "Aucune mémoire enregistrée pour le moment."
                  : 'No long-term memories pinned yet.'}
              </p>
              {!searchQuery && (
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  {isFr
                    ? 'Ajoutez vos règles de réapprovisionnement, objectifs de marge ou horaires de livraison pour qu’Ursa s’en souvienne dans toutes les conversations.'
                    : 'Pin your supplier lead times, target margins, or credit policies so Ursa factors them into future business advice.'}
                </p>
              )}
            </div>
          ) : (
            filteredMemories.map((mem) => {
              const badge = getCategoryBadge(mem.category);
              return (
                <div
                  key={mem.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDark
                      ? 'bg-zinc-800/50 hover:bg-zinc-800/80 border-zinc-700/60'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <h3 className="text-xs font-bold tracking-tight text-zinc-200">
                        {mem.key}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(mem.content, mem.id)}
                        className={`p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-zinc-700' : 'hover:bg-slate-200'
                        }`}
                        title={isFr ? "Copier" : "Copy"}
                      >
                        {copiedId === mem.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditClick(mem)}
                        className={`p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-zinc-700' : 'hover:bg-slate-200'
                        }`}
                        title={isFr ? "Modifier" : "Edit"}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(mem.id)}
                        className={`p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer ${
                          isDark ? 'hover:bg-zinc-700' : 'hover:bg-slate-200'
                        }`}
                        title={isFr ? "Supprimer" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                    {mem.content}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-zinc-700/40 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>
                      {isFr ? 'Source: ' : 'Source: '}
                      <strong className="text-zinc-400">
                        {mem.source === 'auto_extracted'
                          ? isFr
                            ? 'Détecté en discussion'
                            : 'Conversation'
                          : isFr
                          ? 'Épinglé par le commerçant'
                          : 'Pinned by Merchant'}
                      </strong>
                    </span>
                    <span>{new Date(mem.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-3 sm:p-4 border-t flex items-center justify-between text-xs ${
          isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px]">
              {isFr ? 'Ursa prend en compte ces faits lors des réponses.' : 'Ursa recalls these facts when answering questions.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            {isFr ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
