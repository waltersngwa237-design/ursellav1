import { serverSupabase } from './business-tools.service.ts';

export interface ImportPreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed?: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export interface ImportPreviewResponse {
  entityType: 'products' | 'customers' | 'expenses';
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ImportPreviewRow[];
  headers: string[];
}

export interface ImportExecuteRequest {
  businessId: string;
  userId?: string;
  entityType: 'products' | 'customers' | 'expenses';
  rows: Array<Record<string, any>>;
}

export class DataIOService {
  /**
   * Helper to parse CSV string into headers and rows
   */
  static parseCSV(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = csvContent
      .split(/\r\n|\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Parse header line respecting possible quotes
    const headers = this.parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const rowObj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        rowObj[header] = (values[idx] || '').trim();
      });
      rows.push(rowObj);
    }

    return { headers, rows };
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  /**
   * Preview and Validate CSV data with row-level error reporting
   */
  static previewImport(csvContent: string, entityType: 'products' | 'customers' | 'expenses'): ImportPreviewResponse {
    const { headers, rows } = this.parseCSV(csvContent);
    const previewRows: ImportPreviewRow[] = [];

    rows.forEach((raw, idx) => {
      const rowNumber = idx + 2; // +1 for 0-index, +1 for header line
      const errors: string[] = [];
      const parsed: Record<string, any> = {};

      if (entityType === 'products') {
        const name = raw['name'] || raw['product name'] || raw['item'];
        const priceStr = raw['selling price'] || raw['price'] || raw['selling_price'] || raw['unit price'];
        const costStr = raw['cost price'] || raw['cost'] || raw['cost_price'] || raw['unit cost'] || '0';
        const stockStr = raw['current stock'] || raw['stock'] || raw['quantity'] || raw['qty'] || '0';
        const minStockStr = raw['minimum stock'] || raw['min stock'] || raw['min_stock'] || '5';
        const sku = raw['sku'] || raw['code'] || raw['barcode'] || '';

        if (!name || name.trim().length === 0) {
          errors.push('Product name is required.');
        } else {
          parsed.name = name.trim();
        }

        const price = Number(priceStr);
        if (isNaN(price) || price < 0) {
          errors.push(`Invalid selling price "${priceStr}". Must be a non-negative number.`);
        } else {
          parsed.selling_price = price;
        }

        const cost = Number(costStr);
        if (isNaN(cost) || cost < 0) {
          errors.push(`Invalid cost price "${costStr}". Must be a non-negative number.`);
        } else {
          parsed.cost_price = cost;
        }

        const stock = Number(stockStr);
        if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
          errors.push(`Invalid stock quantity "${stockStr}". Must be a positive integer.`);
        } else {
          parsed.current_stock = stock;
        }

        const minStock = Number(minStockStr);
        parsed.min_stock_level = isNaN(minStock) ? 5 : minStock;
        parsed.sku = sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
      } else if (entityType === 'customers') {
        const name = raw['name'] || raw['customer name'] || raw['full name'];
        const phone = raw['phone'] || raw['phone number'] || raw['mobile'] || '';
        const email = raw['email'] || raw['email address'] || '';
        const address = raw['address'] || raw['location'] || '';

        if (!name || name.trim().length === 0) {
          errors.push('Customer name is required.');
        } else {
          parsed.name = name.trim();
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push(`Invalid email format "${email}".`);
        } else {
          parsed.email = email || null;
        }

        parsed.phone = phone || null;
        parsed.address = address || null;
      } else if (entityType === 'expenses') {
        const title = raw['title'] || raw['description'] || raw['expense name'] || raw['name'];
        const amountStr = raw['amount'] || raw['cost'] || raw['price'];
        const category = raw['category'] || raw['expense category'] || 'Other Operational Expense';
        const dateStr = raw['date'] || raw['expense date'] || new Date().toISOString().split('T')[0];

        if (!title || title.trim().length === 0) {
          errors.push('Expense title/description is required.');
        } else {
          parsed.title = title.trim();
        }

        const amount = Number(amountStr);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Invalid expense amount "${amountStr}". Must be greater than 0.`);
        } else {
          parsed.amount = amount;
        }

        parsed.category = category.trim();
        parsed.expense_date = dateStr;
      }

      previewRows.push({
        rowNumber,
        raw,
        parsed: errors.length === 0 ? parsed : undefined,
        isValid: errors.length === 0,
        errors,
      });
    });

    const validRowsCount = previewRows.filter((r) => r.isValid).length;

    return {
      entityType,
      totalRows: previewRows.length,
      validRowsCount,
      invalidRowsCount: previewRows.length - validRowsCount,
      rows: previewRows,
      headers,
    };
  }

  /**
   * Execute transactional batch insert for validated rows
   */
  static async executeImport(req: ImportExecuteRequest): Promise<{ success: boolean; importedCount: number; errors: string[] }> {
    const { businessId, entityType, rows } = req;
    if (rows.length === 0) {
      return { success: true, importedCount: 0, errors: [] };
    }

    let inserted = 0;
    const errors: string[] = [];

    try {
      if (entityType === 'products') {
        const payload = rows.map((r) => ({
          business_id: businessId,
          name: r.name,
          sku: r.sku || null,
          selling_price: r.selling_price,
          cost_price: r.cost_price || 0,
          current_stock: r.current_stock || 0,
          min_stock_level: r.min_stock_level || 5,
          is_active: true,
        }));

        const { data, error } = await serverSupabase.from('products').insert(payload).select('id');
        if (error) throw error;
        inserted = data?.length || payload.length;
      } else if (entityType === 'customers') {
        const payload = rows.map((r) => ({
          business_id: businessId,
          name: r.name,
          phone: r.phone || null,
          email: r.email || null,
          address: r.address || null,
          is_active: true,
        }));

        const { data, error } = await serverSupabase.from('customers').insert(payload).select('id');
        if (error) throw error;
        inserted = data?.length || payload.length;
      } else if (entityType === 'expenses') {
        const payload = rows.map((r) => ({
          business_id: businessId,
          title: r.title,
          amount: r.amount,
          category: r.category || 'Other Operational Expense',
          expense_date: r.expense_date || new Date().toISOString().split('T')[0],
          payment_method: 'cash',
        }));

        const { data, error } = await serverSupabase.from('expenses').insert(payload).select('id');
        if (error) throw error;
        inserted = data?.length || payload.length;
      }

      // Record import batch history
      await serverSupabase.from('import_batches').insert({
        business_id: businessId,
        user_id: req.userId || null,
        entity_type: entityType,
        filename: `batch_import_${entityType}_${Date.now()}.csv`,
        total_rows: rows.length,
        successful_rows: inserted,
        failed_rows: 0,
        status: 'completed',
      });

      return { success: true, importedCount: inserted, errors: [] };
    } catch (err: any) {
      console.error('[DataIOService] Import error:', err);
      return { success: false, importedCount: 0, errors: [err.message || 'Database insert failed'] };
    }
  }

  /**
   * Export business data to sanitized CSV
   */
  static async exportDataToCSV(businessId: string, entity: 'products' | 'customers' | 'sales' | 'expenses' | 'inventory' | 'audit_logs'): Promise<string> {
    if (entity === 'products') {
      const { data } = await serverSupabase
        .from('products')
        .select('name, sku, selling_price, cost_price, current_stock, min_stock_level, created_at')
        .eq('business_id', businessId)
        .order('name');

      if (!data || data.length === 0) return 'Name,SKU,Selling Price,Cost Price,Current Stock,Min Stock,Created At\n';
      const header = 'Name,SKU,Selling Price,Cost Price,Current Stock,Min Stock,Created At\n';
      const rows = data.map((d) => `"${(d.name || '').replace(/"/g, '""')}",${d.sku || ''},${d.selling_price},${d.cost_price},${d.current_stock},${d.min_stock_level},${d.created_at}`).join('\n');
      return header + rows;
    }

    if (entity === 'customers') {
      const { data } = await serverSupabase
        .from('customers')
        .select('name, phone, email, address, notes, created_at')
        .eq('business_id', businessId)
        .order('name');

      if (!data || data.length === 0) return 'Name,Phone,Email,Address,Notes,Created At\n';
      const header = 'Name,Phone,Email,Address,Notes,Created At\n';
      const rows = data.map((d) => `"${(d.name || '').replace(/"/g, '""')}","${d.phone || ''}","${d.email || ''}","${(d.address || '').replace(/"/g, '""')}","${(d.notes || '').replace(/"/g, '""')}",${d.created_at}`).join('\n');
      return header + rows;
    }

    if (entity === 'expenses') {
      const { data } = await serverSupabase
        .from('expenses')
        .select('title, amount, category, payment_method, expense_date, notes')
        .eq('business_id', businessId)
        .order('expense_date', { ascending: false });

      if (!data || data.length === 0) return 'Title,Amount,Category,Payment Method,Expense Date,Notes\n';
      const header = 'Title,Amount,Category,Payment Method,Expense Date,Notes\n';
      const rows = data.map((d) => `"${(d.title || '').replace(/"/g, '""')}",${d.amount},"${d.category}","${d.payment_method}","${d.expense_date}","${(d.notes || '').replace(/"/g, '""')}"`).join('\n');
      return header + rows;
    }

    if (entity === 'sales') {
      const { data } = await serverSupabase
        .from('sales')
        .select('receipt_number, total, subtotal, discount, amount_paid, payment_status, payment_method, sold_at')
        .eq('business_id', businessId)
        .order('sold_at', { ascending: false });

      if (!data || data.length === 0) return 'Receipt Number,Total,Subtotal,Discount,Amount Paid,Status,Payment Method,Sold At\n';
      const header = 'Receipt Number,Total,Subtotal,Discount,Amount Paid,Status,Payment Method,Sold At\n';
      const rows = data.map((d) => `"${d.receipt_number}",${d.total},${d.subtotal},${d.discount},${d.amount_paid},"${d.payment_status}","${d.payment_method || 'cash'}","${d.sold_at}"`).join('\n');
      return header + rows;
    }

    return 'Entity,Status,Date\n';
  }
}
