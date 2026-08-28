import type { ImportPreviewResponse } from '../types/index.ts';

export class ClientDataIOService {
  static async previewCSV(
    csvContent: string,
    entityType: 'products' | 'customers' | 'expenses'
  ): Promise<ImportPreviewResponse> {
    const res = await fetch('/api/data/import/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
