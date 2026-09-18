import React, { useState, useEffect, useMemo } from 'react';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useLanguage } from '../../contexts/LanguageContext.tsx';
import { NotesService } from '../../services/notes.service.ts';
import type { MerchantNote, NoteCategory, NoteChecklistItem, AppNavRoute } from '../../types/index.ts';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Modal } from '../../components/common/Modal.tsx';
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  Copy,
  Check,
  Clock,
  User,
  Tag,
  AlertCircle,
  Filter,
  CheckCircle2,
  Sparkles,
  Printer,
  ChevronRight,
  ListTodo,
  Truck,
  Users,
  Flame,
  FileText,
} from 'lucide-react';

interface NotesPageProps {
  onNavigate?: (route: AppNavRoute) => void;
}

const CATEGORY_CONFIG: Record<
  NoteCategory,
  {
    labelEn: string;
    labelFr: string;
    icon: React.ReactNode;
    badgeBg: string;
    badgeText: string;
    border: string;
  }
> = {
  general: {
    labelEn: 'General',
    labelFr: 'Général',
    icon: <StickyNote className="w-3.5 h-3.5" />,
    badgeBg: 'bg-zinc-800',
    badgeText: 'text-zinc-300',
    border: 'border-zinc-700/60',
  },
  shift: {
    labelEn: 'Shift Handover',
    labelFr: 'Passation de service',
    icon: <Clock className="w-3.5 h-3.5" />,
    badgeBg: 'bg-amber-950/50',
    badgeText: 'text-amber-300',
    border: 'border-amber-800/40',
  },
  checklist: {
    labelEn: 'Checklist',
    labelFr: 'Liste de tâches',
    icon: <ListTodo className="w-3.5 h-3.5" />,
    badgeBg: 'bg-emerald-950/50',
    badgeText: 'text-emerald-300',
    border: 'border-emerald-800/40',
  },
  supplier: {
    labelEn: 'Suppliers',
    labelFr: 'Fournisseurs',
    icon: <Truck className="w-3.5 h-3.5" />,
    badgeBg: 'bg-indigo-950/50',
    badgeText: 'text-indigo-300',
    border: 'border-indigo-800/40',
  },
  customer: {
    labelEn: 'Customer Holds',
    labelFr: 'Réservations clients',
    icon: <Users className="w-3.5 h-3.5" />,
    badgeBg: 'bg-purple-950/50',
    badgeText: 'text-purple-300',
    border: 'border-purple-800/40',
  },
  urgent: {
    labelEn: 'Urgent',
    labelFr: 'Urgent',
    icon: <Flame className="w-3.5 h-3.5" />,
    badgeBg: 'bg-rose-950/50',
    badgeText: 'text-rose-300',
    border: 'border-rose-800/40',
  },
};

const COLOR_CONFIG: Record<
  string,
  {
    bg: string;
    border: string;
    accent: string;
  }
> = {
  default: {
    bg: 'bg-white dark:bg-zinc-900',
    border: 'border-slate-200 dark:border-zinc-800',
    accent: 'bg-zinc-500',
  },
  amber: {
    bg: 'bg-amber-50/40 dark:bg-amber-950/20',
    border: 'border-amber-200/80 dark:border-amber-900/40',
    accent: 'bg-amber-500',
  },
  emerald: {
    bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    border: 'border-emerald-200/80 dark:border-emerald-900/40',
    accent: 'bg-emerald-500',
  },
  rose: {
    bg: 'bg-rose-50/40 dark:bg-rose-950/20',
    border: 'border-rose-200/80 dark:border-rose-900/40',
    accent: 'bg-rose-500',
  },
  indigo: {
    bg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
    border: 'border-indigo-200/80 dark:border-indigo-900/40',
    accent: 'bg-indigo-500',
  },
  cyan: {
    bg: 'bg-cyan-50/40 dark:bg-cyan-950/20',
    border: 'border-cyan-200/80 dark:border-cyan-900/40',
    accent: 'bg-cyan-500',
  },
};

export const NotesPage: React.FC<NotesPageProps> = ({ onNavigate }) => {
  const { activeBusiness } = useBusiness();
  const { user, profile } = useAuth();
  const { language } = useLanguage();

  const [notes, setNotes] = useState<MerchantNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);

  // Note Modal state (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MerchantNote | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalCategory, setModalCategory] = useState<NoteCategory>('general');
  const [modalIsPinned, setModalIsPinned] = useState(false);
  const [modalIsChecklist, setModalIsChecklist] = useState(false);
  const [modalColor, setModalColor] = useState<'default' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'cyan'>('default');
  const [modalAuthor, setModalAuthor] = useState('');
  const [modalChecklistItems, setModalChecklistItems] = useState<NoteChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  // Delete Confirmation state
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Load notes
  const refreshNotes = React.useCallback(() => {
    if (!activeBusiness?.id) return;
    const items = NotesService.getNotes(activeBusiness.id);
    setNotes(items);
  }, [activeBusiness?.id]);

  useEffect(() => {
    refreshNotes();

    const handleNotesUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ businessId?: string }>;
      if (!custom.detail?.businessId || custom.detail.businessId === activeBusiness?.id) {
        refreshNotes();
      }
    };

    window.addEventListener('ursella_notes_updated', handleNotesUpdated);
    return () => window.removeEventListener('ursella_notes_updated', handleNotesUpdated);
  }, [refreshNotes, activeBusiness?.id]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.checklist_items &&
          note.checklist_items.some((i) => i.text.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'pinned' && note.is_pinned) ||
        note.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [notes, searchQuery, selectedCategory]);

  const pinnedNotesCount = useMemo(() => notes.filter((n) => n.is_pinned).length, [notes]);

  const handleOpenCreateModal = (category: NoteCategory = 'general', isChecklist = false) => {
    setEditingNote(null);
    setModalTitle('');
    setModalContent('');
    setModalCategory(category);
    setModalIsPinned(false);
    setModalIsChecklist(isChecklist);
    setModalColor(isChecklist ? 'emerald' : category === 'shift' ? 'amber' : 'default');
    setModalAuthor(profile?.full_name || user?.email?.split('@')[0] || 'Staff');
    setModalChecklistItems(isChecklist ? [{ id: '1', text: '', completed: false }] : []);
    setNewChecklistText('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (note: MerchantNote) => {
    setEditingNote(note);
    setModalTitle(note.title);
    setModalContent(note.content);
    setModalCategory(note.category);
    setModalIsPinned(note.is_pinned);
    setModalIsChecklist(note.is_checklist);
    setModalColor(note.color || 'default');
    setModalAuthor(note.author_name || '');
    setModalChecklistItems(note.checklist_items || []);
    setNewChecklistText('');
    setIsModalOpen(true);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id) return;

    const validChecklist = modalChecklistItems
      .map((i) => ({ ...i, text: i.text.trim() }))
      .filter((i) => i.text.length > 0);

    if (editingNote) {
      NotesService.updateNote(activeBusiness.id, editingNote.id, {
        title: modalTitle.trim() || (language === 'fr' ? 'Note sans titre' : 'Untitled Note'),
        content: modalContent,
        category: modalCategory,
        is_pinned: modalIsPinned,
        is_checklist: modalIsChecklist,
        checklist_items: validChecklist,
        color: modalColor,
        author_name: modalAuthor.trim() || 'Staff',
      });
    } else {
      NotesService.createNote(activeBusiness.id, {
        title: modalTitle.trim() || (language === 'fr' ? 'Note sans titre' : 'Untitled Note'),
        content: modalContent,
        category: modalCategory,
        is_pinned: modalIsPinned,
        is_checklist: modalIsChecklist,
        checklist_items: validChecklist,
        color: modalColor,
        author_name: modalAuthor.trim() || 'Staff',
      });
    }

    setIsModalOpen(false);
    refreshNotes();
  };

  const handleDelete = (noteId: string) => {
    if (!activeBusiness?.id) return;
    NotesService.deleteNote(activeBusiness.id, noteId);
    setDeletingNoteId(null);
    refreshNotes();
  };

  const handleTogglePin = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeBusiness?.id) return;
    NotesService.togglePin(activeBusiness.id, noteId);
    refreshNotes();
  };

  const handleToggleChecklist = (noteId: string, itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeBusiness?.id) return;
    NotesService.toggleChecklistItem(activeBusiness.id, noteId, itemId);
    refreshNotes();
  };

  const handleCopyNote = (note: MerchantNote, e: React.MouseEvent) => {
    e.stopPropagation();
    let text = `${note.title}\n`;
    if (note.content) text += `${note.content}\n`;
    if (note.is_checklist && note.checklist_items.length > 0) {
      text += '\nChecklist:\n';
      note.checklist_items.forEach((item) => {
        text += `${item.completed ? '[x]' : '[ ]'} ${item.text}\n`;
      });
    }
    navigator.clipboard.writeText(text);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handlePrintNote = (note: MerchantNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let checklistHtml = '';
    if (note.is_checklist && note.checklist_items.length > 0) {
      checklistHtml = `
        <ul style="list-style: none; padding: 0;">
          ${note.checklist_items
            .map(
              (item) => `
            <li style="margin: 8px 0; font-size: 14px;">
              <input type="checkbox" ${item.completed ? 'checked' : ''} disabled style="margin-right: 8px;" />
              <span style="${item.completed ? 'text-decoration: line-through; color: #666;' : ''}">${item.text}</span>
            </li>
          `
            )
            .join('')}
        </ul>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${note.title} - ${activeBusiness?.name || 'Ursella POS'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 30px; color: #111; max-width: 600px; margin: 0 auto; }
            h1 { font-size: 20px; margin-bottom: 6px; }
            .meta { font-size: 12px; color: #666; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
            .content { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${note.title}</h1>
          <div class="meta">
            ${activeBusiness?.name || 'Ursella Business'} • ${note.category.toUpperCase()} • ${new Date(note.updated_at).toLocaleDateString()}
            ${note.author_name ? ` • Author: ${note.author_name}` : ''}
          </div>
          <div class="content">${note.content || ''}</div>
          ${checklistHtml}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleAddModalChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setModalChecklistItems([
      ...modalChecklistItems,
      {
        id: Date.now().toString(),
        text: newChecklistText.trim(),
        completed: false,
      },
    ]);
    setNewChecklistText('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <StickyNote className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {language === 'fr' ? 'Notes & Mémos du Magasin' : 'Store Notes & Memos'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {language === 'fr'
                  ? 'Listes de tâches, passations de caisse, mémos fournisseurs et consignes d’équipe'
                  : 'Daily checklists, shift handovers, supplier memos, and team operational instructions'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenCreateModal('checklist', true)}
            leftIcon={<ListTodo className="w-4 h-4 text-emerald-500" />}
          >
            {language === 'fr' ? '+ Liste de tâches' : '+ Checklist'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenCreateModal('general', false)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {language === 'fr' ? 'Nouvelle Note' : 'New Note'}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                language === 'fr'
                  ? 'Rechercher dans les notes et tâches...'
                  : 'Search notes, checklists, memos...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="w-full md:w-auto flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              {language === 'fr' ? 'Toutes' : 'All'} ({notes.length})
            </button>

            {pinnedNotesCount > 0 && (
              <button
                onClick={() => setSelectedCategory('pinned')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'pinned'
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:text-amber-500'
                }`}
              >
                <Pin className="w-3 h-3 fill-current" />
                <span>{language === 'fr' ? 'Épinglées' : 'Pinned'}</span> ({pinnedNotesCount})
              </button>
            )}

            {(Object.keys(CATEGORY_CONFIG) as NoteCategory[]).map((catKey) => {
              const cfg = CATEGORY_CONFIG[catKey];
              const count = notes.filter((n) => n.category === catKey).length;
              if (count === 0 && selectedCategory !== catKey) return null;

              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === catKey
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {cfg.icon}
                  <span>{language === 'fr' ? cfg.labelFr : cfg.labelEn}</span>
                  <span className="text-[10px] opacity-75 font-normal">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <StickyNote className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
              {searchQuery
                ? language === 'fr'
                  ? 'Aucune note trouvée'
                  : 'No notes match your search'
                : language === 'fr'
                ? 'Aucune note pour ce commerce'
                : 'No store notes yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {searchQuery
                ? language === 'fr'
                  ? 'Essayez avec un autre mot-clé ou réinitialisez le filtre de catégorie.'
                  : 'Try searching with a different term or clear the filter.'
                : language === 'fr'
                ? 'Créez votre première consigne de caisse, liste de tâches ou mémo fournisseur.'
                : 'Create opening checklists, shift handover memos, and supplier contacts for your team.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenCreateModal('general')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {language === 'fr' ? 'Créer une note' : 'Create Note'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCreateModal('checklist', true)}
              leftIcon={<ListTodo className="w-4 h-4 text-emerald-500" />}
            >
              {language === 'fr' ? 'Créer une checklist' : 'Create Checklist'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const catConfig = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.general;
            const colorTheme = COLOR_CONFIG[note.color || 'default'] || COLOR_CONFIG.default;

            const totalChecklist = note.checklist_items?.length || 0;
            const completedChecklist =
              note.checklist_items?.filter((i) => i.completed).length || 0;
            const progressPercent =
              totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

            return (
              <div
                key={note.id}
                onClick={() => handleOpenEditModal(note)}
                className={`group relative rounded-2xl border ${colorTheme.border} ${colorTheme.bg} p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer space-y-4`}
              >
                {/* Header: Category & Pin toggle */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${catConfig.border} ${catConfig.badgeBg} ${catConfig.badgeText}`}
                    >
                      {catConfig.icon}
                      <span>{language === 'fr' ? catConfig.labelFr : catConfig.labelEn}</span>
                    </span>

                    {note.is_pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                        <Pin className="w-2.5 h-2.5 fill-current" />
                        <span>{language === 'fr' ? 'Épinglé' : 'Pinned'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(note.id, e)}
                      title={
                        note.is_pinned
                          ? language === 'fr'
                            ? 'Détacher'
                            : 'Unpin'
                          : language === 'fr'
                          ? 'Épingler en haut'
                          : 'Pin to top'
                      }
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        note.is_pinned
                          ? 'text-amber-400 bg-amber-400/15 hover:bg-amber-400/25'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleCopyNote(note, e)}
                      title={language === 'fr' ? 'Copier le contenu' : 'Copy content'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {copiedNoteId === note.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePrintNote(note, e)}
                      title={language === 'fr' ? 'Imprimer / Exporter' : 'Print / Export'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title and Body */}
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-2 tracking-tight group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                    {note.title}
                  </h3>

                  {note.content && (
                    <p className="text-xs text-slate-600 dark:text-zinc-300 whitespace-pre-wrap line-clamp-4 leading-relaxed font-normal">
                      {note.content}
                    </p>
                  )}

                  {/* Checklist display */}
                  {note.is_checklist && note.checklist_items && note.checklist_items.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                        <span>
                          {language === 'fr' ? 'Progression :' : 'Progress:'} {completedChecklist} /{' '}
                          {totalChecklist}
                        </span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      <div className="space-y-1 pt-1 max-h-36 overflow-y-auto pr-1">
                        {note.checklist_items.map((item) => (
                          <div
                            key={item.id}
                            onClick={(e) => handleToggleChecklist(note.id, item.id, e)}
                            className="flex items-start gap-2 text-xs py-0.5 rounded-sm hover:bg-slate-100/60 dark:hover:bg-zinc-800/40 px-1 -mx-1 transition-colors cursor-pointer"
                          >
                            {item.completed ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                            )}
                            <span
                              className={`text-xs select-none ${
                                item.completed
                                  ? 'line-through text-slate-400 dark:text-zinc-500'
                                  : 'text-slate-700 dark:text-zinc-300'
                              }`}
                            >
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer metadata & Delete */}
                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
                  <div className="flex items-center gap-2 truncate">
                    {note.author_name && (
                      <span className="flex items-center gap-1 font-medium truncate">
                        <User className="w-3 h-3" />
                        <span>{note.author_name}</span>
                      </span>
                    )}
                    <span>•</span>
                    <span>
                      {new Date(note.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingNoteId(note.id);
                    }}
                    title={language === 'fr' ? 'Supprimer la note' : 'Delete note'}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingNote
            ? language === 'fr'
              ? 'Modifier la note'
              : 'Edit Store Note'
            : modalIsChecklist
            ? language === 'fr'
              ? 'Nouvelle liste de tâches'
              : 'New Checklist'
            : language === 'fr'
            ? 'Créer une note'
            : 'Create Store Note'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveNote} className="space-y-4">
          <Input
            label={language === 'fr' ? 'Titre de la note' : 'Note Title'}
            placeholder={
              modalIsChecklist
                ? language === 'fr'
                  ? 'Ex: Checklist d’ouverture du matin'
                  : 'e.g. Morning Opening Checklist'
                : language === 'fr'
                ? 'Ex: Consigne de caisse - Registre 1'
                : 'e.g. Shift Handover - Register 1'
            }
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            required
            autoFocus
          />

          {/* Category and Color Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                {language === 'fr' ? 'Catégorie' : 'Category'}
              </label>
              <select
                value={modalCategory}
                onChange={(e) => setModalCategory(e.target.value as NoteCategory)}
                className="w-full text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-amber-500"
              >
                {(Object.keys(CATEGORY_CONFIG) as NoteCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {language === 'fr' ? CATEGORY_CONFIG[cat].labelFr : CATEGORY_CONFIG[cat].labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                {language === 'fr' ? 'Couleur d’accent' : 'Card Tint'}
              </label>
              <div className="flex items-center gap-2 pt-1">
                {(['default', 'amber', 'emerald', 'rose', 'indigo', 'cyan'] as const).map((clr) => (
                  <button
                    key={clr}
                    type="button"
                    onClick={() => setModalColor(clr)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      clr === 'default'
                        ? 'bg-zinc-700 border-zinc-500'
                        : clr === 'amber'
                        ? 'bg-amber-500 border-amber-300'
                        : clr === 'emerald'
                        ? 'bg-emerald-500 border-emerald-300'
                        : clr === 'rose'
                        ? 'bg-rose-500 border-rose-300'
                        : clr === 'indigo'
                        ? 'bg-indigo-500 border-indigo-300'
                        : 'bg-cyan-500 border-cyan-300'
                    } ${modalColor === clr ? 'scale-125 ring-2 ring-amber-400' : 'opacity-70 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Note content textarea */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
              {language === 'fr' ? 'Contenu de la note' : 'Note Content / Details'}
            </label>
            <textarea
              rows={4}
              placeholder={
                language === 'fr'
                  ? 'Saisissez vos remarques, instructions ou contacts...'
                  : 'Enter instructions, handover comments, or memos...'
              }
              value={modalContent}
              onChange={(e) => setModalContent(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Checklist Toggle & Items */}
          <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalIsChecklist}
                  onChange={(e) => setModalIsChecklist(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <span>{language === 'fr' ? 'Activer le mode Checklist (Cases à cocher)' : 'Enable Checklist Mode (Interactive Tasks)'}</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-amber-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalIsPinned}
                  onChange={(e) => setModalIsPinned(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <Pin className="w-3.5 h-3.5 fill-current" />
                <span>{language === 'fr' ? 'Épingler en haut' : 'Pin to Top'}</span>
              </label>
            </div>

            {modalIsChecklist && (
              <div className="space-y-2.5 bg-slate-50 dark:bg-zinc-950/80 p-3 rounded-xl border border-slate-200 dark:border-zinc-800">
                <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>{language === 'fr' ? 'Éléments de la checklist' : 'Checklist Items'}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {modalChecklistItems.length} {language === 'fr' ? 'tâches' : 'items'}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {modalChecklistItems.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) => {
                          const copy = [...modalChecklistItems];
                          copy[idx].completed = e.target.checked;
                          setModalChecklistItems(copy);
                        }}
                        className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500"
                      />
                      <input
                        type="text"
                        value={item.text}
                        onChange={(e) => {
                          const copy = [...modalChecklistItems];
                          copy[idx].text = e.target.value;
                          setModalChecklistItems(copy);
                        }}
                        placeholder={language === 'fr' ? 'Tâche à effectuer...' : 'Task description...'}
                        className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setModalChecklistItems(modalChecklistItems.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new checklist item row */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddModalChecklistItem();
                      }
                    }}
                    placeholder={
                      language === 'fr'
                        ? 'Ajouter une tâche (appuyer sur Entrée)...'
                        : 'Add a new task (press Enter)...'
                    }
                    className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:border-amber-500"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddModalChecklistItem}
                    disabled={!newChecklistText.trim()}
                  >
                    {language === 'fr' ? 'Ajouter' : 'Add'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-4 h-4" />}
            >
              {editingNote
                ? language === 'fr'
                  ? 'Mettre à jour'
                  : 'Save Changes'
                : language === 'fr'
                ? 'Créer la note'
                : 'Create Note'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingNoteId)}
        onClose={() => setDeletingNoteId(null)}
        title={language === 'fr' ? 'Confirmer la suppression' : 'Confirm Deletion'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p>
              {language === 'fr'
                ? 'Êtes-vous sûr de vouloir supprimer définitivement cette note ? Cette action est irréversible.'
                : 'Are you sure you want to permanently delete this note? This action cannot be undone.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingNoteId(null)}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deletingNoteId && handleDelete(deletingNoteId)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              {language === 'fr' ? 'Supprimer' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
