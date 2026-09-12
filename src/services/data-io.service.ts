import type { ImportPreviewResponse } from '../types/index.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';

export class ClientDataIOService {
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
      }
    } catch {
      // Local fallback
    }
    return headers;
  }

  static async previewCSV(
    csvContent: string,
    entityType: 'products' | 'customers' | 'expenses'
  ): Promise<ImportPreviewResponse> {
    const res = await fetch('/api/data/import/preview', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ csvContent, entityType }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to preview CSV');
    }
    return await res.json();
  }

  static async executeImport(payload: {
    businessId: string;
    userId?: string;
    entityType: 'products' | 'customers' | 'expenses';
    rows: Array<Record<string, any>>;
  }): Promise<{ success: boolean; importedCount: number; errors: string[] }> {
    const res = await fetch('/api/data/import/execute', {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to execute import');
    }
    return await res.json();
  }

  static getExportUrl(businessId: string, entity: 'products' | 'customers' | 'sales' | 'expenses' | 'inventory' | 'audit_logs'): string {
    return `/api/data/export/${entity}?businessId=${encodeURIComponent(businessId)}`;
  }
}
