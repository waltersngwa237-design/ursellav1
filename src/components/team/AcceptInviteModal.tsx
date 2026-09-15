import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Input } from '../common/Input.tsx';
import { TeamService } from '../../services/team.service.ts';
import { CheckCircle2, KeyRound, AlertTriangle, Building2 } from 'lucide-react';

interface AcceptInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: string; email: string; fullName?: string };
  onSuccess: (joinedBiz: { businessId: string; businessName: string }) => void;
}

export const AcceptInviteModal: React.FC<AcceptInviteModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedBusiness, setJoinedBusiness] = useState<{
    businessId: string;
    businessName: string;
    role: string;
  } | null>(null);

  const handleClose = () => {
    setCode('');
    setError(null);
    setJoinedBusiness(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter your 8-character invitation code.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await TeamService.acceptInviteCode(code.trim(), currentUser);
      setJoinedBusiness({
        businessId: res.businessId,
        businessName: res.businessName,
        role: res.role,
      });
      onSuccess({
        businessId: res.businessId,
        businessName: res.businessName,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired invitation code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={joinedBusiness ? 'Welcome to the Team!' : 'Join a Business'}
      description={
        joinedBusiness
          ? `You have joined ${joinedBusiness.businessName} with ${joinedBusiness.role.toUpperCase()} privileges.`
          : 'Enter the invitation code provided by your business owner or store manager.'
      }
      maxWidth="sm"
    >
      {joinedBusiness ? (
        <div className="space-y-4 pt-2">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{joinedBusiness.businessName}</p>
              <p className="text-xs text-emerald-400 font-semibold uppercase">
                Role: {joinedBusiness.role}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            This business is now linked to your account. You can switch to it anytime from the business selector.
          </p>
          <div className="flex justify-end pt-2">
            <Button type="button" variant="primary" onClick={handleClose}>
              Switch to Business
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <Input
            label="Invitation Code *"
            placeholder="e.g. URS-7841"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            autoFocus
            helperText="Check your invitation email or ask your manager for the 8-character code"
          />

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              leftIcon={<Building2 className="w-4 h-4" />}
            >
              Join Business
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
