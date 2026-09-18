import type { MerchantNote, NoteCategory, NoteChecklistItem } from '../types/index.ts';

const NOTES_STORAGE_PREFIX = 'ursella_notes_';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_STARTER_NOTES: Omit<MerchantNote, 'id' | 'business_id' | 'created_at' | 'updated_at'>[] = [
  {
    title: 'Daily Store Opening Checklist',
    content: 'Standard morning checklist before turning on the registers.',
    category: 'checklist',
    is_pinned: true,
    is_checklist: true,
    color: 'emerald',
    checklist_items: [
      { id: '1', text: 'Count cash drawer floating balance ($100 / 50,000 FCFA)', completed: true },
      { id: '2', text: 'Power on receipt printer & check paper roll', completed: true },
      { id: '3', text: 'Check inventory for low-stock bread & milk', completed: false },
      { id: '4', text: 'Inspect refrigerated displays and test thermometer', completed: false },
      { id: '5', text: 'Unlock main entrance & turn on storefront display lights', completed: false },
    ],
    author_name: 'Store Manager',
  },
  {
    title: 'Shift Handover & Drawer Notes',
    content: 'Register 1 had a card terminal reboot at 11:30 AM. Contacted telecom provider; signal is stable now. Extra receipt rolls stored in bottom cabinet.',
    category: 'shift',
    is_pinned: true,
    is_checklist: false,
    color: 'amber',
    checklist_items: [],
    author_name: 'Cashier Alice',
  },
  {
    title: 'Supplier Delivery Contacts',
    content: 'Beverage Distributor: +237 670 000 111 (Delivery Tuesdays)\nFresh Produce Co: +237 690 000 222 (Orders due by 4 PM)\nPackaging & Bags: delivery@packagingco.com',
    category: 'supplier',
    is_pinned: false,
    is_checklist: false,
    color: 'indigo',
    checklist_items: [],
    author_name: 'Store Owner',
  },
];

export const NotesService = {
  getStorageKey(businessId: string): string {
    return `${NOTES_STORAGE_PREFIX}${businessId}`;
  },

  /**
   * Get all notes for a specific business
   */
  getNotes(businessId: string): MerchantNote[] {
    if (!businessId) return [];

    try {
      const key = this.getStorageKey(businessId);
      const raw = localStorage.getItem(key);

      if (!raw) {
        // Seed with starter notes if store has no notes yet
        const seeded = this.seedStarterNotes(businessId);
        return seeded;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Sort: pinned first, then newest updated_at
        return parsed.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) {
            return a.is_pinned ? -1 : 1;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      }
      return [];
    } catch (err) {
      console.warn('[NotesService] Failed to parse notes from storage:', err);
      return [];
    }
  },

  /**
   * Save notes list to storage and broadcast event
   */
  saveNotes(businessId: string, notes: MerchantNote[]): void {
    if (!businessId) return;
    try {
      const key = this.getStorageKey(businessId);
      localStorage.setItem(key, JSON.stringify(notes));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ursella_notes_updated', { detail: { businessId } }));
      }
    } catch (err) {
      console.warn('[NotesService] Error saving notes to storage:', err);
    }
  },

  /**
   * Seed initial starter notes for brand new merchants
   */
  seedStarterNotes(businessId: string): MerchantNote[] {
    const now = new Date().toISOString();
    const seeded: MerchantNote[] = DEFAULT_STARTER_NOTES.map((starter, idx) => ({
      ...starter,
      id: generateUUID(),
      business_id: businessId,
      created_at: new Date(Date.now() - (idx * 60000)).toISOString(),
      updated_at: now,
    }));

    this.saveNotes(businessId, seeded);
    return seeded;
  },

  /**
   * Create a new note
   */
  createNote(
    businessId: string,
    data: {
      title: string;
      content: string;
      category?: NoteCategory;
      is_pinned?: boolean;
      is_checklist?: boolean;
      checklist_items?: NoteChecklistItem[];
      color?: 'default' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'cyan';
      author_name?: string;
    }
  ): MerchantNote {
    const existing = this.getNotes(businessId);
    const now = new Date().toISOString();

    const newNote: MerchantNote = {
      id: generateUUID(),
      business_id: businessId,
      title: data.title.trim() || 'Untitled Note',
      content: data.content || '',
      category: data.category || (data.is_checklist ? 'checklist' : 'general'),
      is_pinned: Boolean(data.is_pinned),
      is_checklist: Boolean(data.is_checklist),
      checklist_items: data.checklist_items || [],
      color: data.color || 'default',
      author_name: data.author_name || 'Staff',
      created_at: now,
      updated_at: now,
    };

    const updated = [newNote, ...existing];
    this.saveNotes(businessId, updated);
    return newNote;
  },

  /**
   * Update an existing note
   */
  updateNote(
    businessId: string,
    noteId: string,
    updates: Partial<Omit<MerchantNote, 'id' | 'business_id' | 'created_at'>>
  ): MerchantNote | null {
    const existing = this.getNotes(businessId);
    const idx = existing.findIndex((n) => n.id === noteId);
    if (idx === -1) return null;

    const updatedNote: MerchantNote = {
      ...existing[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    existing[idx] = updatedNote;
    this.saveNotes(businessId, existing);
    return updatedNote;
  },

  /**
   * Delete a note
   */
  deleteNote(businessId: string, noteId: string): boolean {
    const existing = this.getNotes(businessId);
    const filtered = existing.filter((n) => n.id !== noteId);
    if (filtered.length !== existing.length) {
      this.saveNotes(businessId, filtered);
      return true;
    }
    return false;
  },

  /**
   * Toggle pinned state
   */
  togglePin(businessId: string, noteId: string): boolean {
    const existing = this.getNotes(businessId);
    const note = existing.find((n) => n.id === noteId);
    if (!note) return false;

    note.is_pinned = !note.is_pinned;
    note.updated_at = new Date().toISOString();
    this.saveNotes(businessId, existing);
    return true;
  },

  /**
   * Toggle checklist item completion
   */
  toggleChecklistItem(businessId: string, noteId: string, itemId: string): boolean {
    const existing = this.getNotes(businessId);
    const note = existing.find((n) => n.id === noteId);
    if (!note || !note.checklist_items) return false;

    const item = note.checklist_items.find((i) => i.id === itemId);
    if (!item) return false;

    item.completed = !item.completed;
    note.updated_at = new Date().toISOString();
    this.saveNotes(businessId, existing);
    return true;
  },

  /**
   * Add a checklist item to an existing note
   */
  addChecklistItem(businessId: string, noteId: string, text: string): boolean {
    if (!text.trim()) return false;
    const existing = this.getNotes(businessId);
    const note = existing.find((n) => n.id === noteId);
    if (!note) return false;

    const newItem: NoteChecklistItem = {
      id: generateUUID(),
      text: text.trim(),
      completed: false,
    };

    note.checklist_items = [...(note.checklist_items || []), newItem];
    note.is_checklist = true;
    note.updated_at = new Date().toISOString();
    this.saveNotes(businessId, existing);
    return true;
  },

  /**
   * Delete a checklist item
   */
  deleteChecklistItem(businessId: string, noteId: string, itemId: string): boolean {
    const existing = this.getNotes(businessId);
    const note = existing.find((n) => n.id === noteId);
    if (!note || !note.checklist_items) return false;

    note.checklist_items = note.checklist_items.filter((i) => i.id !== itemId);
    note.updated_at = new Date().toISOString();
    this.saveNotes(businessId, existing);
    return true;
  },
};
