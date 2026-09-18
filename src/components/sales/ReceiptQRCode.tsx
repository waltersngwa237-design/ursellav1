import React, { useState, useEffect } from 'react';
import { QrCode, ShieldCheck, Copy, Check } from 'lucide-react';
import { QRService } from '../../services/qr.service.ts';
import type { SaleWithDetails, Business } from '../../types/index.ts';

interface ReceiptQRCodeProps {
  sale: SaleWithDetails;
  business: Business | null;
  isFr?: boolean;
}

export const ReceiptQRCode: React.FC<ReceiptQRCodeProps> = ({
  sale,
  business,
  isFr = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const payload = QRService.getReceiptPayload(sale, business);
    QRService.generateDataURL(payload, { width: 130, margin: 1 }).then((url) => {
      if (isMounted) {
        setQrDataUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [sale.id, sale.total, sale.amount_paid, business?.name]);

  const handleCopyPayload = () => {
    const payload = QRService.getReceiptPayload(sale, business);
    navigator.clipboard?.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-3 border-t border-dashed border-zinc-800 flex flex-col items-center justify-center text-center select-none">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 mb-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>{isFr ? 'Authentification Numérique' : 'Digital Receipt Verification'}</span>
      </div>

      {qrDataUrl ? (
        <div className="bg-white p-2 rounded-xl shadow-xs border border-zinc-200 inline-block">
          <img
            src={qrDataUrl}
            alt="Receipt Verification QR Code"
            className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      ) : (
        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-zinc-900 animate-pulse rounded-xl border border-zinc-800 flex items-center justify-center">
          <QrCode className="w-6 h-6 text-zinc-700" />
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
        <span>REC-#{sale.id.slice(0, 8).toUpperCase()}</span>
        <button
          type="button"
          onClick={handleCopyPayload}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          title={isFr ? 'Copier la signature numérique' : 'Copy verification payload'}
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      <p className="text-[10px] text-zinc-500 max-w-[200px] leading-tight mt-0.5">
        {isFr
          ? 'Scannez avec un smartphone pour vérifier l’authenticité de ce reçu.'
          : 'Scan with any smartphone camera to authenticate this receipt.'}
      </p>
    </div>
  );
};
