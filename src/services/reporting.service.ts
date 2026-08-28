import type { BusinessReportData } from '../types/index.ts';

export class ClientReportingService {
  static async fetchReport(
    businessId: string,
    type: 'sales' | 'profitability' | 'inventory' | 'expenses' | 'receivables' | 'cash_flow',
    options?: {
      period?: 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_year' | 'custom';
      startDate?: string;
      endDate?: string;
    }
  ): Promise<BusinessReportData> {
    const params = new URLSearchParams({
      businessId,
      period: options?.period || '30d',
    });

    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const res = await fetch(`/api/reports/${type}?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch report');
    }
    return await res.json();
  }
}
