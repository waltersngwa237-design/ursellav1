import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../common/Card.tsx';
import { Button } from '../common/Button.tsx';
import { Badge } from '../common/Badge.tsx';
import { Modal } from '../common/Modal.tsx';
import type { MemberRole, TeamMember, TeamInvitation } from '../../types/index.ts';
import { ROLE_CONFIGS, hasPermission } from '../../utils/rbac.ts';
import { TeamService } from '../../services/team.service.ts';
import { useBusiness } from '../../contexts/BusinessContext.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { InviteMemberModal } from './InviteMemberModal.tsx';
import { EditMemberModal } from './EditMemberModal.tsx';
import { AcceptInviteModal } from './AcceptInviteModal.tsx';
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  Shield,
  KeyRound,
  Trash2,
  Edit3,
  Copy,
  Check,
  RefreshCw,
  Info,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LogIn,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

export const TeamManagementSection: React.FC = () => {
  const { activeBusiness, effectiveRole, setSimulatedRole, refreshBusinesses, setActiveBusinessId } = useBusiness();
  const { user, profile } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isAcceptInviteModalOpen, setIsAcceptInviteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Permissions overview collapsible
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);

  // Copy helper
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const canManageStaff = hasPermission(effectiveRole, 'manage_staff');

  const loadTeamData = useCallback(async () => {
    if (!activeBusiness?.id) return;
    try {
      setLoading(true);
      const [membersList, invitesList] = await Promise.all([
        TeamService.getMembers(
          activeBusiness.id,
          user?.id,
          user?.email,
          profile?.full_name || undefined
        ),
        Promise.resolve(TeamService.getInvitations(activeBusiness.id)),
      ]);
      setMembers(membersList);
      setInvites(invitesList.filter((i) => i.status === 'pending'));
    } finally {
      setLoading(false);
    }
  }, [activeBusiness?.id, user?.id, user?.email, profile?.full_name]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleCopyInvite = (invite: TeamInvitation) => {
    const inviteUrl = `${window.location.origin}/#/signin?invite=${invite.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCodeId(invite.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleRevokeInvite = (inviteId: string) => {
    if (!activeBusiness?.id) return;
    TeamService.revokeInvitation(activeBusiness.id, inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    setStatusMessage('Invitation was revoked.');
  };

  const handleConfirmDelete = async () => {
    if (!activeBusiness?.id || !memberToDelete) return;
    try {
      setIsDeleting(true);
      await TeamService.removeMember(activeBusiness.id, memberToDelete.id, user?.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToDelete.id));
      setMemberToDelete(null);
      setStatusMessage(`Removed ${memberToDelete.fullName} from this business.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove member.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSimulateOperator = (member: TeamMember) => {
    setSimulatedRole(member.role);
    setStatusMessage(`Active POS role switched to "${member.role.toUpperCase()}" (${member.fullName}).`);
  };

  const currentUserData = {
    id: user?.id || '00000000-0000-4000-8000-000000000001',
    name: profile?.full_name || 'Business Owner',
    email: user?.email || 'owner@ursella.app',
  };

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Team & Staff Management
            </h3>
            <p className="text-[11px] text-zinc-400">
              Control multi-user access, POS cashier authorizations, and permissions for {activeBusiness?.name}.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAcceptInviteModalOpen(true)}
            className="text-xs"
            leftIcon={<LogIn className="w-3.5 h-3.5 text-zinc-400" />}
          >
            Join with Code
          </Button>

          {canManageStaff && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsInviteModalOpen(true)}
              className="text-xs"
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add / Invite Member
            </Button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'members'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Active Team ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'invites'
                ? 'bg-zinc-800 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Pending Invites</span>
            {invites.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center">
                {invites.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowPermissionsGuide(!showPermissionsGuide)}
          className="text-xs text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Role Permissions Guide</span>
          {showPermissionsGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Collapsible Role Permissions Guide */}
      {showPermissionsGuide && (
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3 animate-in fade-in">
          <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            Security & Permission Matrix
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
            {(['owner', 'admin', 'manager', 'cashier', 'staff'] as MemberRole[]).map((r) => {
              const cfg = ROLE_CONFIGS[r];
              return (
                <div key={r} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-100 uppercase">{cfg.label}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Max {cfg.maxDiscountPercent}% Disc
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {cfg.description}
                  </p>
                  <div className="pt-1 border-t border-zinc-800 flex flex-wrap gap-1">
                    {cfg.permissions.map((p) => (
                      <span key={p} className="text-[9px] bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-400 font-mono">
                        {p.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Members Roster */}
      {activeTab === 'members' && (
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading team members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No team members registered yet. Click &quot;Add / Invite Member&quot; to begin.
            </div>
          ) : (
            members.map((member) => {
              const roleConfig = ROLE_CONFIGS[member.role] || ROLE_CONFIGS.cashier;
              const initials = member.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={member.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    member.isCurrentUser
                      ? 'bg-zinc-900/80 border-emerald-500/30'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {member.fullName}
                        </span>
                        {member.isCurrentUser && (
                          <Badge variant="emerald" size="sm">
                            YOU
                          </Badge>
                        )}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleConfig.badgeBg} ${roleConfig.badgeBorder} ${roleConfig.badgeText}`}
                        >
                          {roleConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          {member.email}
                        </span>
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-zinc-500" />
                            {member.phone}
                          </span>
                        )}
                        <span className="text-[11px] text-zinc-500">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSimulateOperator(member)}
                      title={`Quickly switch terminal to test as ${member.role.toUpperCase()}`}
                      className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/50 transition-all flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="hidden md:inline">Test As</span> {member.role}
                    </button>

                    {canManageStaff && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMember(member)}
                          className="text-xs text-zinc-400 hover:text-zinc-200"
                          title="Edit role or change PIN"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        {!member.isCurrentUser && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMemberToDelete(member)}
                            className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            title="Remove member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pending Invitations Tab */}
      {activeTab === 'invites' && (
        <div className="space-y-2">
          {invites.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              No pending invitations. Click &quot;Add / Invite Member&quot; to send an invite link or code.
            </div>
          ) : (
            invites.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{inv.fullName}</span>
                    <Badge variant="amber" size="sm">
                      PENDING
                    </Badge>
                    <Badge variant="blue" size="sm">
                      {inv.role.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-zinc-500" />
                      {inv.email}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Code: {inv.inviteCode}
                    </span>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires in 7 days
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyInvite(inv)}
                    className="text-xs"
                    leftIcon={
                      copiedCodeId === inv.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {copiedCodeId === inv.id ? 'Copied' : 'Copy Link'}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invite Modal */}
      {activeBusiness && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          businessId={activeBusiness.id}
          businessName={activeBusiness.name}
          currentUser={currentUserData}
          onMemberAdded={(newM) => {
            setMembers((prev) => [...prev, newM]);
            setStatusMessage(`Added ${newM.fullName} to ${activeBusiness.name}.`);
          }}
          onInviteCreated={(newInv) => {
            setInvites((prev) => [...prev, newInv]);
            setStatusMessage(`Generated invitation for ${newInv.fullName} (Code: ${newInv.inviteCode}).`);
          }}
        />
      )}

      {/* Edit Role & PIN Modal */}
      {activeBusiness && (
        <EditMemberModal
          isOpen={Boolean(editingMember)}
          onClose={() => setEditingMember(null)}
          businessId={activeBusiness.id}
          member={editingMember}
          currentUserId={user?.id || ''}
          onUpdated={(up) => {
            setMembers((prev) => prev.map((m) => (m.id === up.id ? up : m)));
            setStatusMessage(`Updated permissions for ${up.fullName}.`);
          }}
        />
      )}

      {/* Accept Invite Modal */}
      <AcceptInviteModal
        isOpen={isAcceptInviteModalOpen}
        onClose={() => setIsAcceptInviteModalOpen(false)}
        currentUser={currentUserData}
        onSuccess={async ({ businessId, businessName }) => {
          await refreshBusinesses();
          setActiveBusinessId(businessId);
          setStatusMessage(`Switched to ${businessName}.`);
        }}
      />

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={Boolean(memberToDelete)}
        onClose={() => setMemberToDelete(null)}
        title="Remove Team Member"
        description={`Are you sure you want to revoke access for ${memberToDelete?.fullName}?`}
        maxWidth="sm"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              This user will immediately lose access to all products, sales records, and settings for this business.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Confirm Removal
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};
