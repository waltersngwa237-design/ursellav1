import { jsPDF } from 'jspdf';
import type {
  Business,
  SaleWithDetails,
  BusinessReportData,
  CurrencyConfig,
  CustomerWithSummary,
  Sale,
  Payment,
} from '../types/index.ts';

/**
 * Clean sanitization for PDF text output to avoid font encoding issues.
 */
function sanitizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

export class PDFAndPrintService {
  /**
   * Generates a sharp, standalone printable HTML document for an isolated iframe.
   * This guarantees that ONLY the receipt is printed and no screen / modal UI is captured.
   */
  private static getReceiptHTML(
    sale: SaleWithDetails,
    business: Business | null,
    currencyConfig: CurrencyConfig
  ): string {
    const anyBiz = business as (Business & { phone?: string; address?: string }) | null;
    const businessName = business?.name || 'Ursella Merchant';
    const businessDesc = business?.description || 'Official Sales Receipt';
    const businessPhone = anyBiz?.phone ? `Tel: ${anyBiz.phone}` : '';
    const businessAddress = anyBiz?.address ? `${anyBiz.address}` : (business?.country || '');
    const dateFormatted = new Date(sale.sold_at).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const receiptNum = sale.id.substring(0, 8).toUpperCase();
    const customerName = sale.customers?.name || 'Walk-in Customer';
    const customerPhone = sale.customers?.phone ? `(${sale.customers.phone})` : '';
    const paymentMethod = sale.payment_method ? sale.payment_method.replace('_', ' ').toUpperCase() : 'CASH';

    const itemsHtml = sale.sale_items
      .map((item) => {
        const itemTotal = currencyConfig.format(item.total);
        const unitPrice = currencyConfig.format(item.unit_price);
        const discountText = item.discount > 0 ? `<div class="discount">- Discount: ${currencyConfig.format(item.discount)}</div>` : '';
        return `
          <tr>
            <td class="item-name">
              <div class="name">${item.product_name_snapshot}</div>
              <div class="qty-unit">${item.quantity} x ${unitPrice}</div>
              ${discountText}
            </td>
            <td class="item-total">${itemTotal}</td>
          </tr>
        `;
      })
      .join('');

    const discountRow =
      sale.discount > 0
        ? `<tr><td>Discount</td><td class="text-right">-${currencyConfig.format(sale.discount)}</td></tr>`
        : '';
    const taxRow =
      sale.tax > 0
        ? `<tr><td>Tax / VAT</td><td class="text-right">+${currencyConfig.format(sale.tax)}</td></tr>`
        : '';
    const debtRow =
      sale.amount_due > 0
        ? `<tr class="debt-row"><td><strong>BALANCE DUE (DEBT)</strong></td><td class="text-right"><strong>${currencyConfig.format(sale.amount_due)}</strong></td></tr>`
        : `<tr><td>Status</td><td class="text-right" style="color: #059669; font-weight: bold;">PAID IN FULL</td></tr>`;

    const notesSection = sale.notes ? `<div class="notes">Note: ${sale.notes}</div>` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt #${receiptNum}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Courier New", Courier, monospace, sans-serif;
            background: #ffffff;
            color: #000000;
            width: 80mm;
            max-width: 80mm;
            padding: 5mm;
            font-size: 11px;
            line-height: 1.35;
          }
          .receipt-container {
            width: 100%;
          }
          .header {
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 1px dashed #000;
            margin-bottom: 8px;
          }
          .biz-name {
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-family: sans-serif;
          }
          .biz-desc {
            font-size: 10px;
            color: #333;
            margin-top: 2px;
          }
          .biz-contact {
            font-size: 9px;
            color: #555;
            margin-top: 2px;
          }
          .receipt-tag {
            margin-top: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .meta {
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px dashed #777;
            font-size: 10px;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }
          th {
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
          }
          th.text-right, td.text-right {
            text-align: right;
          }
          td {
            padding: 4px 0;
            vertical-align: top;
          }
          .item-name .name {
            font-weight: 600;
            font-size: 11px;
            font-family: sans-serif;
          }
          .item-name .qty-unit {
            font-size: 9px;
            color: #555;
          }
          .discount {
            font-size: 9px;
            color: #059669;
          }
          .item-total {
            text-align: right;
            font-weight: bold;
            font-size: 11px;
            white-space: nowrap;
          }
          .totals {
            border-top: 1px dashed #000;
            padding-top: 6px;
            margin-bottom: 8px;
          }
          .totals table td {
            padding: 2px 0;
          }
          .grand-total {
            font-size: 13px;
            font-weight: 900;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
          }
          .grand-total td {
            padding: 4px 0 !important;
          }
          .debt-row {
            color: #dc2626;
            font-weight: bold;
          }
          .notes {
            font-size: 9px;
            font-style: italic;
            border-top: 1px dashed #ccc;
            padding-top: 4px;
            margin-bottom: 8px;
            color: #444;
          }
          .footer {
            text-align: center;
            font-size: 9px;
            color: #555;
            border-top: 1px dashed #000;
            padding-top: 8px;
            margin-top: 6px;
          }
          .barcode-mock {
            letter-spacing: 4px;
            font-family: monospace;
            font-size: 10px;
            font-weight: bold;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <div class="biz-name">${businessName}</div>
            <div class="biz-desc">${businessDesc}</div>
            ${businessPhone ? `<div class="biz-contact">${businessPhone}</div>` : ''}
            ${businessAddress ? `<div class="biz-contact">${businessAddress}</div>` : ''}
            <div class="receipt-tag">RECEIPT #${receiptNum}</div>
          </div>

          <div class="meta">
            <div class="meta-row">
              <span>Date:</span>
              <span><strong>${dateFormatted}</strong></span>
            </div>
            <div class="meta-row">
              <span>Customer:</span>
              <span><strong>${customerName} ${customerPhone}</strong></span>
            </div>
            <div class="meta-row">
              <span>Payment:</span>
              <span><strong>${paymentMethod}</strong></span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item & Qty</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <td>Subtotal</td>
                <td class="text-right">${currencyConfig.format(sale.subtotal)}</td>
              </tr>
              ${discountRow}
              ${taxRow}
              <tr class="grand-total">
                <td>GRAND TOTAL</td>
                <td class="text-right">${currencyConfig.format(sale.total)}</td>
              </tr>
              <tr>
                <td>Amount Paid</td>
                <td class="text-right">${currencyConfig.format(sale.amount_paid)}</td>
              </tr>
              ${debtRow}
            </table>
          </div>

          ${notesSection}

          <div class="footer">
            <div class="barcode-mock">*${receiptNum}*</div>
            <div>Thank you for your business!</div>
            <div style="font-size: 8px; color: #888; margin-top: 2px;">Powered by Ursella Business Intelligence</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Triggers clean isolated printing of ONLY the customized receipt.
   * Creates an invisible iframe to prevent capturing background UI or dark mode screens.
   */
  public static printReceiptDirectly(
    sale: SaleWithDetails,
    business: Business | null,
    currencyConfig: CurrencyConfig
  ): void {
    const htmlContent = this.getReceiptHTML(sale, business, currencyConfig);

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    iframe.id = 'ursella-receipt-print-frame';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      // Fallback
      window.print();
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print iframe error:', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 250);
    };
  }

  /**
   * Generates and downloads a high-resolution, vector PDF receipt.
   */
  public static exportReceiptPDF(
    sale: SaleWithDetails,
    business: Business | null,
    currencyConfig: CurrencyConfig
  ): void {
    const businessName = business?.name || 'Ursella Merchant';
    const businessDesc = business?.description || 'Official Sales Receipt';
    const receiptNum = sale.id.substring(0, 8).toUpperCase();
    const dateStr = new Date(sale.sold_at).toLocaleString();
    const customerName = sale.customers?.name || 'Walk-in Customer';
    const customerPhone = sale.customers?.phone || '';
    const paymentMethod = sale.payment_method ? sale.payment_method.replace('_', ' ').toUpperCase() : 'CASH';

    // Calculate height dynamically based on item count
    const itemLinesCount = sale.sale_items.length;
    const docHeight = Math.max(160, 100 + itemLinesCount * 12 + (sale.notes ? 15 : 0));

    // Create 80mm thermal receipt PDF in jsPDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, docHeight],
    });

    const pageWidth = 80;
    const margin = 5;
    const contentWidth = pageWidth - margin * 2;
    let y = 8;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(sanitizeText(businessName).toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(sanitizeText(businessDesc), pageWidth / 2, y, { align: 'center' });
    y += 3.5;

    const anyBiz = business as (Business & { phone?: string; address?: string }) | null;
    if (anyBiz?.phone || anyBiz?.address || business?.country) {
      const contact = [anyBiz?.phone ? `Tel: ${anyBiz.phone}` : '', anyBiz?.address || business?.country || '']
        .filter(Boolean)
        .join(' | ');
      doc.text(sanitizeText(contact), pageWidth / 2, y, { align: 'center' });
      y += 3.5;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`RECEIPT #${receiptNum}`, pageWidth / 2, y, { align: 'center' });
    y += 4;

    // Divider Line
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    // Metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);

    doc.text('Date:', margin, y);
    doc.text(dateStr, margin + contentWidth, y, { align: 'right' });
    y += 3.5;

    doc.text('Customer:', margin, y);
    doc.text(sanitizeText(customerPhone ? `${customerName} (${customerPhone})` : customerName), margin + contentWidth, y, {
      align: 'right',
    });
    y += 3.5;

    doc.text('Payment Method:', margin, y);
    doc.text(paymentMethod, margin + contentWidth, y, { align: 'right' });
    y += 4;

    // Table Header
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y, margin + contentWidth, y);
    y += 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('ITEM & QTY', margin, y);
    doc.text('AMOUNT', margin + contentWidth, y, { align: 'right' });
    y += 2.5;

    doc.line(margin, y, margin + contentWidth, y);
    y += 3.5;

    // Items
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    sale.sale_items.forEach((item) => {
      const itemTitle = sanitizeText(item.product_name_snapshot);
      const qtyUnitText = `${item.quantity} x ${currencyConfig.format(item.unit_price)}`;
      const totalFormatted = currencyConfig.format(item.total);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      // Truncate long name to fit 48mm width
      const truncatedName = itemTitle.length > 26 ? `${itemTitle.substring(0, 24)}...` : itemTitle;
      doc.text(truncatedName, margin, y);

      doc.text(totalFormatted, margin + contentWidth, y, { align: 'right' });
      y += 3;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(qtyUnitText, margin, y);

      if (item.discount > 0) {
        doc.setTextColor(16, 140, 90);
        doc.text(`(-${currencyConfig.format(item.discount)})`, margin + 28, y);
      }
      y += 4;
    });

    // Totals Section
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y, margin + contentWidth, y);
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    doc.text('Subtotal:', margin, y);
    doc.text(currencyConfig.format(sale.subtotal), margin + contentWidth, y, { align: 'right' });
    y += 3.5;

    if (sale.discount > 0) {
      doc.setTextColor(16, 140, 90);
      doc.text('Discount:', margin, y);
      doc.text(`-${currencyConfig.format(sale.discount)}`, margin + contentWidth, y, { align: 'right' });
      y += 3.5;
    }

    if (sale.tax > 0) {
      doc.setTextColor(60, 60, 60);
      doc.text('Tax / VAT:', margin, y);
      doc.text(`+${currencyConfig.format(sale.tax)}`, margin + contentWidth, y, { align: 'right' });
      y += 3.5;
    }

    // Grand Total Solid Box
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y, margin + contentWidth, y);
    y += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('GRAND TOTAL:', margin, y);
    doc.text(currencyConfig.format(sale.total), margin + contentWidth, y, { align: 'right' });
    y += 3;

    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text('Amount Paid:', margin, y);
    doc.text(currencyConfig.format(sale.amount_paid), margin + contentWidth, y, { align: 'right' });
    y += 3.5;

    if (sale.amount_due > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(200, 30, 30);
      doc.text('BALANCE DUE (DEBT):', margin, y);
      doc.text(currencyConfig.format(sale.amount_due), margin + contentWidth, y, { align: 'right' });
      y += 4;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 140, 90);
      doc.text('STATUS:', margin, y);
      doc.text('PAID IN FULL', margin + contentWidth, y, { align: 'right' });
      y += 4;
    }

    if (sale.notes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(`Note: ${sanitizeText(sale.notes)}`, margin, y);
      y += 4;
    }

    // Footer
    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`*${receiptNum}*`, pageWidth / 2, y, { align: 'center' });
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your business!', pageWidth / 2, y, { align: 'center' });
    y += 3;
    doc.text('Powered by Ursella Business Intelligence', pageWidth / 2, y, { align: 'center' });

    // Save PDF
    doc.save(`Receipt-${receiptNum}.pdf`);
  }

  /**
   * Generates and downloads an executive Financial Report PDF (A4 format).
   */
  public static exportReportPDF(
    report: BusinessReportData,
    businessName: string,
    currencySymbol: string = '$'
  ): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 16;

    // Header Bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, y, contentWidth, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizeText(businessName).toUpperCase(), margin + 6, y + 9);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    const reportTitle = `${report.reportType.replace('_', ' ').toUpperCase()} REPORT`;
    doc.text(reportTitle, margin + 6, y + 16);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Horizon: ${report.periodLabel}`, margin + contentWidth - 6, y + 9, { align: 'right' });
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`, margin + contentWidth - 6, y + 16, {
      align: 'right',
    });

    y += 30;

    // Summary Metrics Cards (Grid of up to 4 metrics)
    const metricsEntries = Object.entries(report.summaryMetrics);
    if (metricsEntries.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('EXECUTIVE KPI SUMMARY', margin, y);
      y += 5;

      const cardWidth = (contentWidth - (metricsEntries.length - 1) * 4) / Math.min(metricsEntries.length, 4);
      metricsEntries.slice(0, 4).forEach(([key, val], idx) => {
        const cardX = margin + idx * (cardWidth + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cardX, y, cardWidth, 18, 2, 2, 'FD');

        const label = key.replace(/([A-Z])/g, ' $1').toUpperCase();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label.substring(0, 22), cardX + 3, y + 5);

        const isNum = typeof val === 'number';
        const formattedVal = isNum
          ? key.toLowerCase().includes('count') || key.toLowerCase().includes('skus')
            ? val.toLocaleString()
            : key.toLowerCase().includes('percent')
            ? `${val}%`
            : `${currencySymbol}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(val);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(formattedVal, cardX + 3, y + 13);
      });

      y += 24;
    }

    // Breakdown Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('DETAILED BREAKDOWN LEDGER', margin, y);
    y += 5;

    if (report.breakdownRows.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('No ledger entries recorded for the selected timeframe.', margin, y + 5);
    } else {
      const columns = Object.keys(report.breakdownRows[0]).slice(0, 6);
      const colWidth = contentWidth / columns.length;

      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y + 7, margin + contentWidth, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);

      columns.forEach((col, cIdx) => {
        const title = col.replace(/([A-Z])/g, ' $1').toUpperCase();
        doc.text(title.substring(0, 15), margin + cIdx * colWidth + 2, y + 4.8);
      });

      y += 8;

      // Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      report.breakdownRows.forEach((row, rIdx) => {
        // Page break check
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 16;
          // Re-draw table header
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 7, 'F');
          doc.line(margin, y + 7, margin + contentWidth, y + 7);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          columns.forEach((col, cIdx) => {
            const title = col.replace(/([A-Z])/g, ' $1').toUpperCase();
            doc.text(title.substring(0, 15), margin + cIdx * colWidth + 2, y + 4.8);
          });
          y += 8;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
        }

        // Alternating row background
        if (rIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 6, 'F');
        }

        columns.forEach((col, cIdx) => {
          const val = row[col];
          const textVal =
            typeof val === 'number'
              ? val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
              : String(val ?? '-');
          doc.text(sanitizeText(textVal).substring(0, 18), margin + cIdx * colWidth + 2, y + 3.8);
        });

        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + 5.5, margin + contentWidth, y + 5.5);
        y += 6;
      });
    }

    // Footer
    const footerY = pageHeight - 12;
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, margin + contentWidth, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Ursella Business Intelligence - GAAP Aligned & Immutable Ledger Verified', margin, footerY + 2);
    doc.text(`Page 1 of 1`, margin + contentWidth, footerY + 2, { align: 'right' });

    doc.save(`Report-${report.reportType}-${report.periodLabel.replace(/\s+/g, '_')}.pdf`);
  }

  /**
   * Generates and downloads a Customer Account Statement PDF.
   */
  public static exportCustomerStatementPDF(
    customer: CustomerWithSummary,
    sales: Sale[],
    payments: Payment[],
    business: Business | null,
    currencyConfig: CurrencyConfig
  ): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 16;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizeText(business?.name || 'Ursella Merchant').toUpperCase(), margin + 6, y + 9);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('STATEMENT OF ACCOUNT & TRANSACTION LEDGER', margin + 6, y + 16);

    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + contentWidth - 6, y + 9, { align: 'right' });
    doc.text(`Account: ${sanitizeText(customer.name)}`, margin + contentWidth - 6, y + 16, { align: 'right' });

    y += 30;

    // Customer Overview Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('CUSTOMER INFORMATION', margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Name: ${sanitizeText(customer.name)}`, margin + 4, y + 11);
    doc.text(`Phone: ${customer.phone || 'N/A'}`, margin + 4, y + 16);

    doc.text(`Total Purchases: ${currencyConfig.format(customer.total_spent)}`, margin + 80, y + 11);
    doc.text(`Orders Count: ${customer.purchase_count}`, margin + 80, y + 16);

    // Outstanding Balance Callout
    const balColor = customer.outstanding_balance > 0 ? [220, 38, 38] : [5, 150, 105];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(balColor[0], balColor[1], balColor[2]);
    doc.text('OUTSTANDING BALANCE:', margin + contentWidth - 60, y + 11);
    doc.setFontSize(11);
    doc.text(currencyConfig.format(customer.outstanding_balance), margin + contentWidth - 60, y + 17);

    y += 28;

    // Order History Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('SALES ORDER HISTORY', margin, y);
    y += 5;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.line(margin, y + 7, margin + contentWidth, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('DATE', margin + 3, y + 4.8);
    doc.text('RECEIPT #', margin + 35, y + 4.8);
    doc.text('TOTAL', margin + 75, y + 4.8);
    doc.text('PAID', margin + 110, y + 4.8);
    doc.text('DUE (DEBT)', margin + 145, y + 4.8);
    doc.text('STATUS', margin + contentWidth - 20, y + 4.8);

    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    if (sales.length === 0) {
      doc.setTextColor(100, 116, 139);
      doc.text('No sales recorded for this customer.', margin + 3, y + 4);
      y += 8;
    } else {
      sales.slice(0, 15).forEach((sale, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 6, 'F');
        }

        doc.setTextColor(30, 41, 59);
        doc.text(new Date(sale.sold_at).toLocaleDateString(), margin + 3, y + 3.8);
        doc.text(sale.id.substring(0, 8).toUpperCase(), margin + 35, y + 3.8);
        doc.text(currencyConfig.format(sale.total), margin + 75, y + 3.8);
        doc.text(currencyConfig.format(sale.amount_paid), margin + 110, y + 3.8);

        if (sale.amount_due > 0) {
          doc.setTextColor(220, 38, 38);
          doc.text(currencyConfig.format(sale.amount_due), margin + 145, y + 3.8);
        } else {
          doc.setTextColor(100, 116, 139);
          doc.text('0.00', margin + 145, y + 3.8);
        }

        doc.setTextColor(sale.payment_status === 'paid' ? 16 : 200, sale.payment_status === 'paid' ? 140 : 30, 50);
        doc.text(sale.payment_status.toUpperCase(), margin + contentWidth - 20, y + 3.8);

        y += 6;
      });
    }

    y += 6;

    // Payments Section
    if (payments.length > 0 && y < pageHeight - 40) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('PAYMENT RECEIPTS & SETTLEMENTS', margin, y);
      y += 5;

      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.line(margin, y + 7, margin + contentWidth, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text('DATE', margin + 3, y + 4.8);
      doc.text('METHOD', margin + 45, y + 4.8);
      doc.text('AMOUNT', margin + 90, y + 4.8);
      doc.text('MEMO / REFERENCE', margin + 130, y + 4.8);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      payments.slice(0, 10).forEach((p, pIdx) => {
        if (pIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 0.5, contentWidth, 6, 'F');
        }
        doc.setTextColor(30, 41, 59);
        doc.text(new Date(p.paid_at).toLocaleDateString(), margin + 3, y + 3.8);
        doc.text(p.payment_method.replace('_', ' ').toUpperCase(), margin + 45, y + 3.8);
        doc.setTextColor(5, 150, 105);
        doc.text(currencyConfig.format(p.amount), margin + 90, y + 3.8);
        doc.setTextColor(100, 116, 139);
        doc.text(sanitizeText(p.notes || p.reference || '-').substring(0, 30), margin + 130, y + 3.8);
        y += 6;
      });
    }

    // Footer
    const footerY = pageHeight - 12;
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, margin + contentWidth, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Customer Account Statement - Ursella Merchant Ledger', margin, footerY + 2);
    doc.text(`Page 1 of 1`, margin + contentWidth, footerY + 2, { align: 'right' });

    doc.save(`Statement-${sanitizeText(customer.name).replace(/\s+/g, '_')}.pdf`);
  }

  /**
   * Directly prints a Customer Statement in an isolated frame.
   */
  public static printCustomerStatementDirectly(
    customer: CustomerWithSummary,
    sales: Sale[],
    payments: Payment[],
    business: Business | null,
    currencyConfig: CurrencyConfig
  ): void {
    const businessName = business?.name || 'Ursella Merchant';
    const dateFormatted = new Date().toLocaleDateString();

    const salesRows = sales
      .map(
        (s) => `
        <tr>
          <td>${new Date(s.sold_at).toLocaleDateString()}</td>
          <td>#${s.id.substring(0, 8).toUpperCase()}</td>
          <td style="text-align: right;">${currencyConfig.format(s.total)}</td>
          <td style="text-align: right; color: #059669;">${currencyConfig.format(s.amount_paid)}</td>
          <td style="text-align: right; color: ${s.amount_due > 0 ? '#dc2626' : '#666'};">${currencyConfig.format(s.amount_due)}</td>
          <td style="text-align: center;">${s.payment_status.toUpperCase()}</td>
        </tr>
      `
      )
      .join('');

    const paymentsRows = payments
      .map(
        (p) => `
        <tr>
          <td>${new Date(p.paid_at).toLocaleDateString()}</td>
          <td>${p.payment_method.replace('_', ' ').toUpperCase()}</td>
          <td style="text-align: right; font-weight: bold; color: #059669;">${currencyConfig.format(p.amount)}</td>
          <td>${p.notes || p.reference || '-'}</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Statement - ${customer.name}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 15mm; color: #0f172a; font-size: 12px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .biz-title { font-size: 18px; font-weight: 800; text-transform: uppercase; }
          .doc-title { font-size: 12px; color: #475569; margin-top: 2px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
          .bal-box { text-align: right; font-weight: bold; }
          .bal-val { font-size: 16px; color: ${customer.outstanding_balance > 0 ? '#dc2626' : '#059669'}; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
          td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
          .section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
          .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="biz-title">${businessName}</div>
            <div class="doc-title">CUSTOMER STATEMENT OF ACCOUNT</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #64748b;">
            Date: ${dateFormatted}
          </div>
        </div>

        <div class="info-grid">
          <div>
            <strong>Customer:</strong> ${customer.name}<br/>
            ${customer.phone ? `<strong>Phone:</strong> ${customer.phone}<br/>` : ''}
            <strong>Total Spent:</strong> ${currencyConfig.format(customer.total_spent)}
          </div>
          <div class="bal-box">
            <div>OUTSTANDING BALANCE</div>
            <div class="bal-val">${currencyConfig.format(customer.outstanding_balance)}</div>
          </div>
        </div>

        <div class="section-title">Sales Order History</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt #</th>
              <th style="text-align: right;">Total</th>
              <th style="text-align: right;">Paid</th>
              <th style="text-align: right;">Due</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${salesRows || '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No orders recorded.</td></tr>'}
          </tbody>
        </table>

        ${
          payments.length > 0
            ? `
          <div class="section-title">Recorded Payments</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th style="text-align: right;">Amount</th>
                <th>Memo / Ref</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsRows}
            </tbody>
          </table>
        `
            : ''
        }

        <div class="footer">
          Ursella Business Intelligence - Official Customer Ledger
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error(e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 250);
    };
  }

  /**
   * Directly prints a Business Report in an isolated frame.
   */
  public static printReportDirectly(
    report: BusinessReportData,
    businessName: string,
    currencySymbol: string = '$'
  ): void {
    const reportTitle = `${report.reportType.replace('_', ' ').toUpperCase()} REPORT`;
    const dateFormatted = new Date(report.generatedAt).toLocaleString();

    const metricsHtml = Object.entries(report.summaryMetrics)
      .map(([k, v]) => {
        const isNum = typeof v === 'number';
        const formatted = isNum
          ? k.toLowerCase().includes('count') || k.toLowerCase().includes('skus')
            ? v.toLocaleString()
            : k.toLowerCase().includes('percent')
            ? `${v}%`
            : `${currencySymbol}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(v);
        return `
          <div class="kpi-card">
            <div class="kpi-label">${k.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
            <div class="kpi-val">${formatted}</div>
          </div>
        `;
      })
      .join('');

    const columns = report.breakdownRows.length > 0 ? Object.keys(report.breakdownRows[0]) : [];
    const headersHtml = columns
      .map((col) => `<th>${col.replace(/([A-Z])/g, ' $1').toUpperCase()}</th>`)
      .join('');

    const rowsHtml = report.breakdownRows
      .map(
        (row) => `
        <tr>
          ${columns
            .map(
              (c) => `
            <td>${typeof row[c] === 'number' ? row[c].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (row[c] ?? '-')}</td>
          `
            )
            .join('')}
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${reportTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 12mm; color: #0f172a; font-size: 11px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .biz-title { font-size: 16px; font-weight: 800; text-transform: uppercase; }
          .doc-title { font-size: 12px; color: #059669; font-weight: bold; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 6px; }
          .kpi-label { font-size: 9px; color: #64748b; font-weight: bold; }
          .kpi-val { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
          td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
          tr:nth-child(even) { background-color: #fafafa; }
          .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 6px; text-align: center; font-size: 9px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="biz-title">${businessName}</div>
            <div class="doc-title">${reportTitle}</div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            Horizon: <strong>${report.periodLabel}</strong><br/>
            Generated: ${dateFormatted}
          </div>
        </div>

        <div class="kpi-grid">
          ${metricsHtml}
        </div>

        <table>
          <thead>
            <tr>${headersHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="100%" style="text-align: center; color: #94a3b8; padding: 20px;">No records found.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Ursella Business Intelligence - Deterministic Financial Ledger
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error(e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 250);
    };
  }
}
