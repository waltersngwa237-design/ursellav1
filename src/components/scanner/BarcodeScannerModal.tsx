import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertCircle,
  Barcode,
  QrCode,
  X,
  Search,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';
import type { ProductWithCategory, CurrencyConfig } from '../../types/index.ts';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductWithCategory[];
  onProductScanned: (product: ProductWithCategory) => void;
  currencyConfig: CurrencyConfig;
  isFr?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductScanned,
  currencyConfig,
  isFr = false,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    product?: ProductWithCategory;
    success: boolean;
    timestamp: number;
  } | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);
  const readerId = 'ursella-pos-scanner-viewport';

  // Synthesized audio feedback (zero latency Web Audio API oscillator)
  const playBeep = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz A5 chirp
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, ctx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio context blocked or not permitted
    }
  };

  const triggerHaptic = (success: boolean) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(success ? [40, 30, 40] : [100]);
    }
  };

  // Find product by barcode / SKU / ID
  const lookupProduct = (code: string): ProductWithCategory | undefined => {
    const cleanCode = code.trim().toLowerCase();
    return products.find((p) => {
      if (p.sku && p.sku.toLowerCase() === cleanCode) return true;
      if (p.id.toLowerCase() === cleanCode) return true;
      if ((p as any).barcode && (p as any).barcode.toLowerCase() === cleanCode) return true;
      if (p.name.toLowerCase() === cleanCode) return true;
      return false;
    });
  };

  const handleProcessCode = (rawCode: string) => {
    if (!rawCode || cooldownRef.current) return;
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, 1200);

    const matchedProduct = lookupProduct(cleanCode);

    if (matchedProduct) {
      playBeep(true);
      triggerHaptic(true);
      setLastScannedResult({
        code: cleanCode,
        product: matchedProduct,
        success: true,
        timestamp: Date.now(),
      });
      onProductScanned(matchedProduct);
    } else {
      playBeep(false);
      triggerHaptic(false);
      setLastScannedResult({
        code: cleanCode,
        success: false,
        timestamp: Date.now(),
      });
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        html5QrCodeRef.current = null;
        setCameraActive(false);
        setTorchOn(false);
        setHasTorch(false);
      }
    }
  };

  const startScanner = async (cameraId?: string) => {
    setCameraError(null);
    try {
      // First ensure previous instance is cleaned up
      await stopScanner();

      // Check if mediaDevices exists
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          isFr
            ? "L'appareil photo n'est pas accessible sur cet appareil ou ce navigateur."
            : 'Camera API is not supported on this browser/device.'
        );
      }

      // Preflight getUserMedia to prompt for browser permission cleanly inside iframe
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' },
        });
        // Stop the temporary preview track immediately once permission is granted
        stream.getTracks().forEach((track) => track.stop());
      } catch (permErr: any) {
        if (permErr?.name === 'NotAllowedError' || permErr?.name === 'PermissionDeniedError') {
          throw new Error(
            isFr
              ? "Autorisation refusée. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
              : 'Camera permission denied. Please allow camera access in your browser settings.'
          );
        }
      }

      // Query available cameras
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          if (!cameraId && !selectedCameraId) {
            // Prefer back/environment camera if available
            const backCam = devices.find((d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
            );
            cameraId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(cameraId);
          }
        }
      } catch {
        // Fall back to facingMode constraint
      }

      const scanner = new Html5Qrcode(readerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      html5QrCodeRef.current = scanner;

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      await scanner.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(160, Math.floor(minEdge * 0.72));
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleProcessCode(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );

      setCameraActive(true);

      // Check for torch capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        }
      } catch {
        // Torch not available
      }
    } catch (err: any) {
      console.warn('Scanner init failed:', err);
      setCameraActive(false);
      setCameraError(
        err?.message ||
          (isFr
            ? "Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur."
            : 'Unable to access camera. Check browser permissions.')
      );
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  // Manage lifecycle on modal open/close
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setLastScannedResult(null);
      setManualCode('');
      // Small timeout to allow DOM container to render
      timer = setTimeout(() => {
        startScanner();
      }, 150);
    } else {
      stopScanner();
    }

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessCode(manualCode);
    setManualCode('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base">
              {isFr ? 'Scanner QR Code & Code-Barres' : 'Scan QR & Barcode'}
            </span>
            <span className="block text-[11px] font-normal text-zinc-400">
              {isFr ? 'Encaissement rapide au terminal' : 'High-speed POS product lookup'}
            </span>
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-4 select-none">
        {/* Camera Viewport Container */}
        <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-inner flex flex-col items-center justify-center min-h-[300px] w-full">
          {/* html5-qrcode target div: Always rendered with positive dimensions so html5-qrcode can measure and attach video element */}
          <div
            id={readerId}
            className="w-full max-w-[360px] aspect-square overflow-hidden rounded-xl"
          />

          {/* Fallback / Inactive Camera Overlay */}
          {!cameraActive && (
            <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
                <CameraOff className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-300">
                  {cameraError ? (isFr ? 'Caméra non disponible' : 'Camera Unavailable') : (isFr ? 'Initialisation de la caméra...' : 'Starting Camera...')}
                </p>
                <p className="text-xs text-zinc-500 max-w-xs mt-1">
                  {cameraError || (isFr ? 'Veuillez autoriser l’accès à la caméra pour scanner les codes-barres.' : 'Allow camera access in your browser to scan product barcodes directly.')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => startScanner(selectedCameraId)}
                leftIcon={<Camera className="w-3.5 h-3.5" />}
                className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:text-white text-xs cursor-pointer"
              >
                {isFr ? 'Réessayer la Caméra' : 'Retry Camera'}
              </Button>
            </div>
          )}

          {/* Active HUD Overlays */}
          {cameraActive && (
            <>
              {/* Top Controls Bar */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isFr ? 'Prêt à scanner' : 'Live Scanner'}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-1.5 rounded-full border backdrop-blur-md transition-all ${
                        torchOn
                          ? 'bg-amber-500/80 border-amber-400 text-white'
                          : 'bg-black/60 border-white/10 text-zinc-300 hover:text-white'
                      }`}
                      title={isFr ? 'Lampe torche' : 'Toggle Flashlight'}
                    >
                      {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                    </button>
                  )}
                  {cameras.length > 1 && (
                    <select
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value);
                        startScanner(e.target.value);
                      }}
                      className="bg-black/60 backdrop-blur-md text-[11px] text-zinc-200 border border-white/10 rounded-full px-2 py-1 focus:outline-none max-w-[110px] truncate"
                    >
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label || `Cam ${c.id.slice(0, 4)}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Viewfinder Target Reticle Animation */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 relative rounded-2xl border border-emerald-500/30">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

                  {/* Scanning Laser Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-sm shadow-emerald-400" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Scan Result Feedback Banner */}
        {lastScannedResult && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in-50 duration-200 ${
              lastScannedResult.success
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {lastScannedResult.success ? (
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">
                  {lastScannedResult.success
                    ? `${isFr ? 'Ajouté au Panier' : 'Added to Cart'}: ${lastScannedResult.product?.name}`
                    : `${isFr ? 'Produit Inconnu' : 'Product Not Found'}: "${lastScannedResult.code}"`}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {lastScannedResult.success
                    ? `${currencyConfig.format(lastScannedResult.product?.selling_price || 0)} · SKU: ${
                        lastScannedResult.product?.sku || lastScannedResult.code
                      }`
                    : isFr
                    ? 'Code non associé. Vérifiez le SKU ou ajoutez-le au catalogue.'
                    : 'Unrecognized barcode. Verify SKU or register it in the Product Catalog.'}
                </div>
              </div>
            </div>

            {lastScannedResult.success && (
              <Badge variant="emerald" size="sm" className="shrink-0 font-bold">
                +1
              </Badge>
            )}
          </div>
        )}

        {/* Manual Barcode / SKU Entry Form */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <Barcode className="w-3.5 h-3.5 text-zinc-400" />
            <span>{isFr ? 'Saisie manuelle ou Douchette USB' : 'Manual Barcode or USB Scanner'}</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={isFr ? 'Ex: BEV-COLA-001 ou 735005385...' : 'Ex: BEV-COLA-001 or 735005385...'}
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
              />
              {manualCode && (
                <button
                  type="button"
                  onClick={() => setManualCode('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!manualCode.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-xs px-3.5 shrink-0"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              {isFr ? 'Ajouter' : 'Lookup'}
            </Button>
          </div>
        </form>

        {/* Quick Test Barcode Chips (Great for testing without a printed label) */}
        {products.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <p className="text-[11px] text-zinc-500 font-medium">
              {isFr ? 'Test rapide avec vos produits existants :' : 'Quick test with in-stock products:'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {products.slice(0, 4).map((p) => {
                const codeToTest = p.sku || p.id.slice(0, 8);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProcessCode(p.sku || p.id)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span className="font-semibold truncate max-w-[120px]">{p.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({codeToTest})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="pt-2 flex items-center justify-between text-xs border-t border-zinc-800">
          <span className="text-zinc-500 text-[11px]">
            {isFr ? 'Raccourci clavier : F2 pour ouvrir/fermer' : 'Keyboard Shortcut: F2 to toggle scanner'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs px-4"
          >
            {isFr ? 'Fermer' : 'Done'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
