import QRCode from 'qrcode';
import type { SaleWithDetails, Business } from '../types/index.ts';

export interface ReceiptQRPayload {
  type: 'URSELLA_RECEIPT';
  v: '1.0';
  id: string;
  num: string;
  biz: string;
  date: string;
  total: number;
  paid: number;
  due: number;
  status: 'PAID' | 'DEBT';
}

export class QRService {
  /**
   * Generates a compact structured payload for digital receipt verification.
   */
  public static getReceiptPayload(sale: SaleWithDetails, business: Business | null): string {
    const payload: ReceiptQRPayload = {
      type: 'URSELLA_RECEIPT',
      v: '1.0',
      id: sale.id,
      num: sale.id.slice(0, 8).toUpperCase(),
      biz: business?.name || 'Ursella Store',
      date: (sale as any).sale_date || sale.sold_at,
      total: sale.total,
      paid: sale.amount_paid,
      due: sale.amount_due,
      status: sale.amount_due > 0 ? 'DEBT' : 'PAID',
    };
    return JSON.stringify(payload);
  }

  /**
   * Generates a Base64 PNG data URL of the QR code.
   */
  public static async generateDataURL(
    text: string,
    options?: { width?: number; margin?: number; darkColor?: string; lightColor?: string }
  ): Promise<string> {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: options?.width || 140,
        margin: options?.margin ?? 1,
        color: {
          dark: options?.darkColor || '#000000',
          light: options?.lightColor || '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
      return dataUrl;
    } catch (err) {
      console.warn('QR Code generation failed:', err);
      return '';
    }
  }

  /**
   * Generates a pure vector SVG string of the QR code (optimal for thermal printing and sharp scaling).
   */
  public static async generateSVG(
    text: string,
    options?: { margin?: number; width?: number }
  ): Promise<string> {
    try {
      const svg = await QRCode.toString(text, {
        type: 'svg',
        margin: options?.margin ?? 1,
        width: options?.width || 120,
        errorCorrectionLevel: 'M',
      });
      return svg;
    } catch (err) {
      console.warn('QR SVG generation failed:', err);
      return '';
    }
  }
}
