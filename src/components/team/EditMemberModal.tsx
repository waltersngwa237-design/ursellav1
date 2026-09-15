import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Input } from '../common/Input.tsx';
import type { MemberRole, TeamMember } from '../../types/index.ts';
import { ROLE_CONFIGS } from '../../utils/rbac.ts';
import { TeamService } from '../../services/team.service.ts';
import { Shield, KeyRound, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  member: TeamMember | null;
  currentUserId: string;
  onUpdated: (updatedMember: TeamMember) => void;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  onClose,
  businessId,
  member,
  currentUserId,
  onUpdated,
}) => {
  const [role, setRole] = useState<MemberRole>('cashier');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setPin(member.pin || '1234');
      setError(null);
    }
  }, [member]);

  if (!member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      let updated = member;
      if (role !== member.role) {
        updated = await TeamService.updateMemberRole(businessId, member.id, role, currentUserId);
      }
      if (pin && pin !== member.pin) {
        updated = await TeamService.updateMemberPin(businessId, member.id, pin);
      }

      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update member.');
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleConfig = ROLE_CONFIGS[role];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Member: ${member.fullName}`}
      description={`Modify access role and terminal authorization PIN for ${member.email}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="text-xs font-semibold text-zinc-300 block mb-2">
            Select Member Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['cashier', 'staff', 'manager', 'admin', 'owner'] as MemberRole[]).map((r) => {
              const config = ROLE_CONFIGS[r];
              const isSelected = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase">{config.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
                    Max Discount: {config.maxDiscountPercent}%
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {selectedRoleConfig && (
          <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl space-y-1.5 text-xs">
            <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Permissions:
            </span>
            <div className="flex flex-wrap gap-1">
              {selectedRoleConfig.permissions.map((p) => (
                <span
                  key={p}
                  className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-mono"
                >
                  {p.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        <Input
          label="Terminal PIN (4 Digits)"
          type="password"
          maxLength={4}
          placeholder="1234"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          helperText="Used for POS switch and manager authorization approvals"
        />

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            leftIcon={<UserCheck className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
