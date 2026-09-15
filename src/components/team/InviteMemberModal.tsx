import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Input } from '../common/Input.tsx';
import { Badge } from '../common/Badge.tsx';
import type { MemberRole, TeamMember, TeamInvitation } from '../../types/index.ts';
import { ROLE_CONFIGS } from '../../utils/rbac.ts';
import { TeamService } from '../../services/team.service.ts';
import {
  UserPlus,
  Mail,
  Shield,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Sparkles,
  Phone,
  User,
  Info,
} from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  currentUser: { id: string; name: string; email: string };
  onMemberAdded: (member: TeamMember) => void;
  onInviteCreated: (invite: TeamInvitation) => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  businessId,
  businessName,
  currentUser,
  onMemberAdded,
  onInviteCreated,
}) => {
  const [mode, setMode] = useState<'direct' | 'invite'>('direct');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<MemberRole>('cashier');
  const [pin, setPin] = useState('1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state after creating an invite
  const [createdInvite, setCreatedInvite] = useState<TeamInvitation | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('cashier');
    setPin('1234');
    setError(null);
    setCreatedInvite(null);
    setCopiedLink(false);
    setCopiedCode(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please provide the team member’s full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mode === 'direct') {
        const newMember = await TeamService.addMember(
          businessId,
          {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            role,
            pin: pin.trim() || undefined,
          },
          currentUser.id
        );
        onMemberAdded(newMember);
        handleClose();
      } else {
        const invite = await TeamService.createInvitation(
          businessId,
          businessName,
          currentUser,
          {
            fullName: fullName.trim(),
            email: email.trim(),
            role,
            pin: pin.trim() || undefined,
          }
        );
        setCreatedInvite(invite);
        onInviteCreated(invite);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add team member.');
    } finally {
      setLoading(false);
    }
  };

  const inviteShareUrl = createdInvite
    ? `${window.location.origin}/#/signin?invite=${createdInvite.inviteCode}`
    : '';

  const handleCopyLink = () => {
    if (!inviteShareUrl) return;
    navigator.clipboard.writeText(inviteShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!createdInvite) return;
    navigator.clipboard.writeText(createdInvite.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const selectedRoleConfig = ROLE_CONFIGS[role];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdInvite ? 'Invitation Created' : 'Add Team Member'}
      description={
        createdInvite
          ? `Share this invite code or link with ${createdInvite.fullName} to join ${businessName}.`
          : `Grant staff, managers, or cashiers access to ${businessName}.`
      }
      maxWidth="lg"
    >
      {createdInvite ? (
        <div className="space-y-4 pt-2">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-bold">Invitation is Ready to Share!</span>
            </div>
            <p className="text-xs text-zinc-300">
              When <span className="font-semibold text-white">{createdInvite.fullName}</span> signs in or enters this code, they will automatically gain <span className="font-semibold text-emerald-300 uppercase">{createdInvite.role}</span> permissions.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Shareable Invitation Code
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-bold tracking-widest text-emerald-400">
                  {createdInvite.inviteCode}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  leftIcon={copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedCode ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Direct Join URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteShareUrl}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all truncate"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedLink ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-xs text-zinc-400 flex items-center justify-between">
            <span>Assigned Terminal PIN:</span>
            <span className="font-mono font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">
              {createdInvite.pin || '1234'}
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="button" variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Method Selection: Direct Add vs Invite Link */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                mode === 'direct'
                  ? 'bg-zinc-800 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Direct Add (On-Site Staff)
            </button>
            <button
              type="button"
              onClick={() => setMode('invite')}
              className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                mode === 'invite'
                  ? 'bg-zinc-800 text-white font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Send Invite Link / Code
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name *"
              placeholder="e.g. Samuel Eto'o"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />

            <Input
              label="Email Address *"
              type="email"
              placeholder="e.g. samuel@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number (Optional)"
              type="tel"
              placeholder="+237 6XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="Terminal PIN (4 Digits)"
              type="password"
              maxLength={4}
              placeholder="1234"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              helperText="Used for quick POS operator login & manager overrides"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              Select Member Role & Permissions *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['cashier', 'staff', 'manager', 'admin'] as MemberRole[]).map((r) => {
                const config = ROLE_CONFIGS[r];
                const isSelected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase">{config.label}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2">
                      {config.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Role Capabilities Summary */}
          {selectedRoleConfig && (
            <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  Privileges for {selectedRoleConfig.label}:
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  Max Discount: {selectedRoleConfig.maxDiscountPercent}%
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedRoleConfig.permissions.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-mono"
                  >
                    {p.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
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
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              {mode === 'direct' ? 'Add Member' : 'Generate Invite'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
