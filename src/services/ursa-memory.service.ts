import type { UrsaMemoryFact, UrsaMemoryCategory } from '../types/ai.ts';
import { generateUUID } from '../lib/uuid.ts';

const MEMORY_STORAGE_PREFIX = 'ursella_ursa_memories_';

export class UrsaMemoryService {
  /**
   * Fetches all stored memory facts for a business from localStorage
   */
  public static getMemories(businessId: string): UrsaMemoryFact[] {
    if (!businessId) return [];
    try {
      const raw = localStorage.getItem(`${MEMORY_STORAGE_PREFIX}${businessId}`);
      if (!raw) {
        // Return default starter memory facts if none exist yet
        return this.getSeedMemories(businessId);
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[UrsaMemoryService] Failed to parse memories from storage:', e);
      return [];
    }
  }

  /**
   * Persists memories array to localStorage
   */
  private static saveMemories(businessId: string, memories: UrsaMemoryFact[]): void {
    if (!businessId) return;
    try {
      localStorage.setItem(`${MEMORY_STORAGE_PREFIX}${businessId}`, JSON.stringify(memories));
    } catch (e) {
      console.warn('[UrsaMemoryService] Failed to save memories to storage:', e);
    }
  }

  /**
   * Adds a new memory fact
   */
  public static addMemory(
    businessId: string,
    fact: {
      category: UrsaMemoryCategory;
      key: string;
      content: string;
      source?: 'user_pinned' | 'auto_extracted';
    }
  ): UrsaMemoryFact {
    const existing = this.getMemories(businessId);
    const now = new Date().toISOString();
    const newMemory: UrsaMemoryFact = {
      id: generateUUID(),
      business_id: businessId,
      category: fact.category || 'general',
      key: fact.key.trim(),
      content: fact.content.trim(),
      source: fact.source || 'user_pinned',
      created_at: now,
      updated_at: now,
    };

    const updated = [newMemory, ...existing];
    this.saveMemories(businessId, updated);
    return newMemory;
  }

  /**
   * Updates an existing memory fact
   */
  public static updateMemory(
    businessId: string,
    memoryId: string,
    updates: Partial<Pick<UrsaMemoryFact, 'key' | 'content' | 'category'>>
  ): UrsaMemoryFact | null {
    const existing = this.getMemories(businessId);
    const index = existing.findIndex((m) => m.id === memoryId);
    if (index === -1) return null;

    const updatedItem: UrsaMemoryFact = {
      ...existing[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    existing[index] = updatedItem;
    this.saveMemories(businessId, existing);
    return updatedItem;
  }

  /**
   * Deletes a memory fact by ID
   */
  public static deleteMemory(businessId: string, memoryId: string): boolean {
    const existing = this.getMemories(businessId);
    const filtered = existing.filter((m) => m.id !== memoryId);
    if (filtered.length === existing.length) return false;

    this.saveMemories(businessId, filtered);
    return true;
  }

  /**
   * Clears all memories for a business
   */
  public static clearAll(businessId: string): void {
    if (!businessId) return;
    localStorage.removeItem(`${MEMORY_STORAGE_PREFIX}${businessId}`);
  }

  /**
   * Returns default seed memories to demonstrate Ursa's memory features on first load
   */
  private static getSeedMemories(businessId: string): UrsaMemoryFact[] {
    const now = new Date().toISOString();
    const seeds: UrsaMemoryFact[] = [
      {
        id: 'seed-1',
        business_id: businessId,
        category: 'target',
        key: 'Monthly Profit Target',
        content: 'Aiming for a minimum 25% net profit margin across all product sales.',
        source: 'user_pinned',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'seed-2',
        business_id: businessId,
        category: 'supplier',
        key: 'Main Beverage & Dairy Supplier',
        content: 'Primary supplier delivers every Tuesday at 8:00 AM. Requires minimum 48h advance reorder notice.',
        source: 'user_pinned',
        created_at: now,
        updated_at: now,
      },
      {
        id: 'seed-3',
        business_id: businessId,
        category: 'business_rule',
        key: 'Credit Settlement Rule',
        content: 'Follow up on all customer debts older than 14 days every Friday afternoon.',
        source: 'user_pinned',
        created_at: now,
        updated_at: now,
      },
    ];

    this.saveMemories(businessId, seeds);
    return seeds;
  }
}
