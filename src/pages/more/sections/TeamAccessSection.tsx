import React from 'react';
import { useBusiness } from '../../../contexts/BusinessContext.tsx';
import { useLanguage } from '../../../contexts/LanguageContext.tsx';
import { Card } from '../../../components/common/Card.tsx';
import { Badge } from '../../../components/common/Badge.tsx';
import { TeamManagementSection as TeamMgmtCore } from '../../../components/team/TeamManagementSection.tsx';
import { Users, ShieldCheck, UserCheck } from 'lucide-react';

export const TeamAccessSection: React.FC = () => {
  const { activeRole, activeBusiness } = useBusiness();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header Info Card */}
      <Card className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isFr ? 'Personnel & Rôles d’Équipe' : 'Team Members & Role Access'}
                </h3>
                <Badge variant="blue">{activeRole?.toUpperCase()}</Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {activeBusiness?.name} · {isFr ? 'Gestion des caissiers, gérants et administrateurs' : 'Manage cashiers, shift managers, and administrators'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-400 pt-1">
          <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
            <span className="font-bold text-zinc-200 block mb-0.5">
              {isFr ? 'Caissier' : 'Cashier'}
            </span>
            <span>{isFr ? 'Encaissement rapide, catalogue et reçus. Remise limitée à 10%.' : 'Fast checkout, inventory browsing, receipts. Max 10% discount.'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
            <span className="font-bold text-zinc-200 block mb-0.5">
              {isFr ? 'Gérant de Boutique' : 'Store Manager'}
            </span>
            <span>{isFr ? 'Clôture de caisse Z, réapprovisionnement, remises jusqu’à 50%.' : 'Z-report closeout, stock replenishment, discounts up to 50%.'}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80">
            <span className="font-bold text-zinc-200 block mb-0.5">
              {isFr ? 'Propriétaire' : 'Owner'}
            </span>
            <span>{isFr ? 'Contrôle financier absolu, marges, comptabilité et accès système.' : 'Full financial control, margins, accounting, and system access.'}</span>
          </div>
        </div>
      </Card>

      {/* Core Team Management Component */}
      <TeamMgmtCore />
    </div>
  );
};
