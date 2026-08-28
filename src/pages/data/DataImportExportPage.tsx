import React, { useState } from 'react';
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import { ClientDataIOService } from '../../services/data-io.service.ts';
import type { ImportPreviewResponse } from '../../types/index.ts';

interface DataImportExportPageProps {
  businessId: string;
}

type EntityType = 'products' | 'customers' | 'expenses';

export const DataImportExportPage: React.FC<DataImportExportPageProps> = ({ businessId }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importEntity, setImportEntity] = useState<EntityType>('products');
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number; errors: string[] } | null>(null);

  const sampleHeaders: Record<EntityType, string> = {
    products: 'Name,SKU,Selling Price,Cost Price,Current Stock,Minimum Stock\n"Paracetamol 500mg",MED-001,15.00,8.50,120,20\n"Amoxicillin 250mg",MED-002,24.50,14.00,65,15',
    customers: 'Name,Phone,Email,Address\n"Johnathan Doe",+237670001122,john@example.com,"Douala Bonanjo"\n"Grace Mba",+237699112233,grace@example.com,"Yaounde Bastos"',
    expenses: 'Title,Amount,Category,Date\n"Shop Rent Monthly",350.00,"Rent & Facilities",2026-08-01\n"Electricity & Water Bill",65.20,"Utilities",2026-08-10',
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      setCsvRawText(text);
      validateCSV(text, importEntity);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const validateCSV = async (content: string, entity: EntityType) => {
    if (!content.trim()) return;
    setIsValidating(true);
    try {
      const res = await ClientDataIOService.previewCSV(content, entity);
      setPreview(res);
    } catch (err: any) {
      alert(err.message || 'CSV validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePasteSample = () => {
    const sample = sampleHeaders[importEntity];
    setCsvRawText(sample);
    setFileName(`sample_${importEntity}.csv`);
    validateCSV(sample, importEntity);
  };

  const handleExecuteImport = async () => {
    if (!preview || preview.validRowsCount === 0 || !businessId) return;

    const validRows = preview.rows.filter((r) => r.isValid && r.parsed).map((r) => r.parsed!);
    setIsImporting(true);
    try {
      const result = await ClientDataIOService.executeImport({
        businessId,
        entityType: importEntity,
        rows: validRows,
      });

      setImportResult({
        success: result.success,
        count: result.importedCount,
        errors: result.errors,
      });

      if (result.success) {
        setPreview(null);
        setCsvRawText('');
        setFileName('');
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        count: 0,
        errors: [err.message || 'Import failed'],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const exportEntities: Array<{ id: 'products' | 'customers' | 'sales' | 'expenses'; label: string; desc: string }> = [
    { id: 'products', label: 'Products & Inventory', desc: 'Catalog, pricing, cost of goods, current stock levels, and SKUs.' },
    { id: 'customers', label: 'Customers & Debts', desc: 'Contact book, phone numbers, addresses, and balance ledgers.' },
    { id: 'sales', label: 'Sales & Receipts Ledger', desc: 'All historic POS transactions, discounts, and payment methods.' },
    { id: 'expenses', label: 'Operational Expenses', desc: 'Categorized business expense records, notes, and dates.' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-emerald-400 mb-1">
          <Database className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Data Hub</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Data Migration & Export</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Seamlessly import existing spreadsheet records or export complete business archives with 1-click.
        </p>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'import'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>CSV Bulk Import</span>
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'export'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Full Data Export</span>
        </button>
      </div>

      {/* IMPORT TAB */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Entity Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-400">Target Record Type:</span>
            {(['products', 'customers', 'expenses'] as EntityType[]).map((e) => (
              <button
                key={e}
                onClick={() => {
                  setImportEntity(e);
                  setPreview(null);
                  setImportResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  importEntity === e
                    ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Success Banner */}
          {importResult && importResult.success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-white">Import Successfully Completed!</h4>
                <p className="text-xs text-emerald-300">
                  {importResult.count} {importEntity} have been safely written to your database ledger.
                </p>
              </div>
            </div>
          )}

          {/* Dropzone & Upload Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/40 rounded-3xl p-8 text-center transition-colors"
          >
            <div className="max-w-md mx-auto flex flex-col items-center">
              <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-3">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {fileName ? fileName : `Upload ${importEntity} CSV File`}
              </h3>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Drag and drop your spreadsheet file here, or browse from your computer. Header columns will be auto-matched.
              </p>

              <div className="flex items-center gap-2">
                <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm">
                  <span>Browse CSV</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handlePasteSample}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium flex items-center gap-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Load Sample Template</span>
                </button>
              </div>
            </div>
          </div>

          {/* Validation Preview Card */}
          {isValidating && (
            <div className="py-8 text-center flex items-center justify-center gap-2 text-zinc-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Validating schema, datatypes, and pricing bounds...</span>
            </div>
          )}

          {preview && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Import Preview & Validation</h3>
                  <div className="flex items-center gap-3 text-xs mt-1">
                    <span className="text-zinc-400">Total Rows: <strong>{preview.totalRows}</strong></span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <strong>{preview.validRowsCount} Valid</strong>
                    </span>
                    {preview.invalidRowsCount > 0 && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <strong>{preview.invalidRowsCount} Errors</strong>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleExecuteImport}
                  disabled={isImporting || preview.validRowsCount === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm Import ({preview.validRowsCount} Records)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Rows List */}
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {preview.rows.map((row) => (
                  <div
                    key={row.rowNumber}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                      row.isValid
                        ? 'bg-zinc-950/60 border-zinc-800'
                        : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-800 font-mono text-[11px] text-zinc-400">
                        Row {row.rowNumber}
                      </span>
                      {row.isValid ? (
                        <span className="font-medium text-zinc-200">
                          {row.parsed?.name || row.parsed?.title || 'Valid Record'}
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-rose-400">Validation Errors:</span>
                          <ul className="list-disc list-inside text-rose-300 text-[11px]">
                            {row.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-zinc-500 truncate max-w-xs">
                      {JSON.stringify(row.raw)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPORT TAB */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {exportEntities.map((ent) => (
            <div key={ent.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>{ent.label}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{ent.desc}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-mono">Format: .CSV (Sanitized)</span>
                <a
                  href={ClientDataIOService.getExportUrl(businessId, ent.id)}
                  download
                  className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
