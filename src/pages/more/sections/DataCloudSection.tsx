import React, { useState, useEffect } from 'react';
import { useBusiness } from '../../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { isSupabaseConfigured } from '../../../lib/supabase/client.ts';
import { OfflineSyncService } from '../../../services/offline-sync.service.ts';
import { IndexedDBService } from '../../../services/indexed-db.service.ts';
import { Card } from '../../../components/common/Card.tsx';
import { Button } from '../../../components/common/Button.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import { Modal } from '../../../components/common/Modal.tsx';
import type { AppNavRoute } from '../../../types/index.ts';
import {
  Database,
  Shield,
  FileText,
  CreditCard,
  ChevronRight,
  RefreshCw,
  Trash2,
  AlertTriangle,
  HardDrive,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';

interface DataCloudSectionProps {
  onNavigate: (route: AppNavRoute) => void;
  onStatusMessage: (msg: string) => void;
}

export const DataCloudSection: React.FC<DataCloudSectionProps> = ({
  onNavigate,
  onStatusMessage,
}) => {
  const {
    activeBusiness,
    resetCurrentBusinessData,
    seedSampleCatalog,
  } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [isSeedLoading, setIsSeedLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Sync & Storage State
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cachedProductsCount, setCachedProductsCount] = useState<number | null>(null);
  const [cachedCustomersCount, setCachedCustomersCount] = useState<number | null>(null);

  useEffect(() => {
    setPendingSyncCount(OfflineSyncService.getPendingCount());
    const unsubscribe = OfflineSyncService.subscribe((count, syncing) => {
      setPendingSyncCount(count);
      setIsSyncing(syncing);
    });

    // Read IndexedDB counts if available
    IndexedDBService.getItemCount('products').then(setCachedProductsCount).catch(() => {});
    IndexedDBService.getItemCount('customers').then(setCachedCustomersCount).catch(() => {});

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await OfflineSyncService.processQueue();
      setPendingSyncCount(OfflineSyncService.getPendingCount());
      onStatusMessage(isFr ? 'Synchronisation du cache effectuée.' : 'Cache synchronization complete.');
    } catch (err: any) {
      onStatusMessage(err?.message || (isFr ? 'Erreur de synchronisation.' : 'Sync error.'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedCatalog = async () => {
    try {
      setIsSeedLoading(true);
      await seedSampleCatalog();
      onStatusMessage(isFr ? 'Catalogue initial chargé avec succès.' : 'Sample catalog seeded successfully.');
      IndexedDBService.getItemCount('products').then(setCachedProductsCount).catch(() => {});
    } finally {
      setIsSeedLoading(false);
    }
  };

  const handleResetData = async () => {
    try {
      setIsResetLoading(true);
      await resetCurrentBusinessData();
      setShowResetConfirm(false);
      onStatusMessage(isFr ? 'Données réinitialisées avec succès.' : 'Store workspace reset successfully.');
      IndexedDBService.getItemCount('products').then(setCachedProductsCount).catch(() => {});
      IndexedDBService.getItemCount('customers').then(setCachedCustomersCount).catch(() => {});
    } catch (err: any) {
      console.error('Reset error:', err);
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => onNavigate('reports')}
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
              {isFr ? 'Rapports Financiers' : 'Financial Reports'}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isFr ? 'Compte de résultat, marges et trésorerie.' : 'P&L, Margins, Sales, and Cash Flow.'}
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('data-io')}
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isFr ? 'Import & Export Excel / CSV' : 'Data Import & Export'}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isFr ? 'Sauvegardes complètes et transferts.' : 'Full backups and spreadsheet transfers.'}
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('billing')}
          className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-left transition-all group flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="mt-3">
            <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
              {isFr ? 'Abonnement & Quotas' : 'Billing & Cloud Quotas'}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {isFr ? 'Plafonds de produits, IA et boutiques.' : 'Product limits, AI quotas, and stores.'}
            </p>
          </div>
        </button>
      </div>

      {/* Cloud & Local Storage Architecture */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isFr ? 'Architecture de Sécurité & Cache' : 'Security Architecture & Storage Engine'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isFr
                  ? 'Isolation stricte multi-tenant et stockage local haute performance.'
                  : 'Multi-tenant RLS isolation and local high-performance cache.'}
              </p>
            </div>
          </div>
          <Badge variant={isSupabaseConfigured ? 'emerald' : 'amber'}>
            {isSupabaseConfigured ? 'RLS SECURED' : 'LOCAL CACHE'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">Supabase RLS</span>
              <Badge variant={isSupabaseConfigured ? 'emerald' : 'zinc'} size="sm">
                {isSupabaseConfigured ? 'ACTIVE' : 'LOCAL'}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400">
              {isSupabaseConfigured
                ? isFr ? 'Isolation hermétique des données par ID d’entreprise.' : 'Strict tenant isolation via PostgreSQL Row Level Security.'
                : isFr ? 'Mode démo / local autonome.' : 'Local mock sandbox storage mode.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">IndexedDB Cache</span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">
                {cachedProductsCount !== null ? `${cachedProductsCount} items` : 'READY'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {isFr
                ? 'Indexation locale ultra-rapide pour code-barres et caisse hors-ligne.'
                : 'Sub-millisecond barcode & customer lookup storage.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200">Sync Queue</span>
              <Badge variant={pendingSyncCount > 0 ? 'amber' : 'emerald'} size="sm">
                {pendingSyncCount > 0 ? `${pendingSyncCount} PENDING` : 'SYNCED'}
              </Badge>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-400">
                {pendingSyncCount > 0 ? (isFr ? 'En attente du réseau' : 'Awaiting network') : (isFr ? 'Toutes données synchronisées' : 'All transactions synchronized')}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualSync}
                isLoading={isSyncing}
                className="text-[10px] py-0.5 px-2 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Workspace Actions Card */}
      <Card className="space-y-4">
        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider pb-2 border-b border-zinc-800">
          {isFr ? 'Gestion de l’Espace de Travail' : 'Workspace Maintenance & Demo Tools'}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                {isFr ? 'Catalogue Exemple & Catégories' : 'Seed Starter Catalog'}
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">
                {isFr
                  ? 'Injecte 10 produits avec codes-barres, prix et stocks pour tester immédiatement la caisse.'
                  : 'Inject 10 sample products with barcodes and prices to test scanning & checkout.'}
              </p>
            </div>
            <div className="pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSeedCatalog}
                isLoading={isSeedLoading}
                className="text-xs cursor-pointer"
              >
                {isFr ? 'Charger le Catalogue Exemple' : 'Seed Sample Catalog'}
              </Button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />
                {isFr ? 'Remise à Zéro des Données' : 'Wipe & Reset Store Data'}
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">
                {isFr
                  ? 'Efface toutes les ventes de test, articles et dépenses enregistrées pour repartir à neuf.'
                  : 'Clear all test transactions, sales, and catalog items for this store.'}
              </p>
            </div>
            <div className="pt-3">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs cursor-pointer"
              >
                {isFr ? 'Réinitialiser la Boutique' : 'Reset Store Data'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={isFr ? 'Remise à Zéro de la Boutique' : 'Reset Store Workspace'}
        description={isFr ? 'Êtes-vous sûr de vouloir effacer toutes les transactions et stocks locaux ?' : 'Are you sure you want to wipe all local transactions and inventory?'}
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{isFr ? 'Cette action effacera tous les produits, ventes, clients et dépenses de test pour cette boutique.' : 'This will erase all test products, sales, customers, and expenses for this business.'}</p>
              <p className="mt-1 text-rose-200/80">{isFr ? 'Vos paramètres d’entreprise et votre profil utilisateur seront conservés.' : 'Your business settings and login profile will remain intact.'}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
            >
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleResetData}
              isLoading={isResetLoading}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {isFr ? 'Confirmer & Tout Réinitialiser' : 'Confirm & Wipe Data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
