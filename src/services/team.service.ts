import { supabase, isSupabaseConfigured } from '../lib/supabase/client.ts';
import { generateUUID, isValidUUID } from '../lib/uuid.ts';
import type { MemberRole, TeamMember, TeamInvitation } from '../types/index.ts';

const MEMBERS_KEY_PREFIX = 'ursella_team_members_';
const INVITES_KEY_PREFIX = 'ursella_team_invitations_';
const GLOBAL_INVITES_KEY = 'ursella_all_active_invitations';

export const TeamService = {
  /**
   * Fetch all team members for a business
   */
  async getMembers(
    businessId: string,
    currentUserId?: string,
    currentUserEmail?: string,
    currentUserName?: string
  ): Promise<TeamMember[]> {
    if (!businessId) return [];

    const localKey = `${MEMBERS_KEY_PREFIX}${businessId}`;
    let members: TeamMember[] = [];

    // 1. Read local storage cache
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        members = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse local team members:', e);
    }

    // 2. Fetch from Supabase if configured
    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        const { data: dbMembers, error: memErr } = await (supabase as any)
          .from('business_members')
          .select(`
            id,
            business_id,
            role,
            user_id,
            created_at
          `)
          .eq('business_id', businessId);

        if (!memErr && dbMembers && dbMembers.length > 0) {
          const userIds: string[] = dbMembers.map((m: any) => m.user_id).filter(Boolean);

          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            try {
              const { data: profiles } = await (supabase as any)
                .from('profiles')
                .select('*')
                .in('id', userIds);
              if (profiles) {
                profilesMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
              }
            } catch (err) {
              console.warn('Profiles query error in team service:', err);
            }
          }

          // Merge Supabase members with local metadata (like PINs)
          const mergedList: TeamMember[] = dbMembers.map((m: any) => {
            const profile = profilesMap[m.user_id];
            const localMatch = members.find((lm) => lm.userId === m.user_id || lm.id === m.id);

            return {
              id: m.id,
              userId: m.user_id,
              businessId: m.business_id,
              role: (m.role as MemberRole) || 'staff',
              fullName: profile?.full_name || localMatch?.fullName || (m.user_id === currentUserId ? currentUserName || 'Owner' : 'Team Member'),
              email: profile?.email || localMatch?.email || (m.user_id === currentUserId ? currentUserEmail || '' : 'staff@business.local'),
              phone: profile?.phone || localMatch?.phone || null,
              avatarUrl: profile?.avatar_url || localMatch?.avatarUrl || null,
              joinedAt: m.created_at || localMatch?.joinedAt || new Date().toISOString(),
              pin: localMatch?.pin || (m.role === 'owner' ? '8888' : m.role === 'manager' ? '1234' : '0000'),
              status: localMatch?.status || 'active',
              isCurrentUser: Boolean(currentUserId && m.user_id === currentUserId),
            };
          });

          // Also keep any mock/demo members created locally for preview
          for (const lm of members) {
            if (!mergedList.some((m) => m.id === lm.id || (lm.userId && m.userId === lm.userId))) {
              mergedList.push(lm);
            }
          }

          members = mergedList;
        }
      } catch (err) {
        console.warn('Supabase getMembers error, relying on local members cache:', err);
      }
    }

    // 3. If list is completely empty, bootstrap current user as owner
    if (members.length === 0 && currentUserId) {
      const ownerMember: TeamMember = {
        id: generateUUID(),
        userId: currentUserId,
        businessId,
        role: 'owner',
        fullName: currentUserName || 'Business Owner',
        email: currentUserEmail || 'owner@ursella.app',
        joinedAt: new Date().toISOString(),
        pin: '8888',
        status: 'active',
        isCurrentUser: true,
      };
      members = [ownerMember];
      try {
        localStorage.setItem(localKey, JSON.stringify(members));
      } catch {}
    } else {
      // Mark current user flag accurately
      members = members.map((m) => ({
        ...m,
        isCurrentUser: Boolean(currentUserId && (m.userId === currentUserId || (currentUserEmail && m.email.toLowerCase() === currentUserEmail.toLowerCase()))),
      }));
    }

    return members;
  },

  /**
   * Save members list to local storage
   */
  saveLocalMembers(businessId: string, members: TeamMember[]) {
    try {
      localStorage.setItem(`${MEMBERS_KEY_PREFIX}${businessId}`, JSON.stringify(members));
    } catch (e) {
      console.warn('Failed to save local team members:', e);
    }
  },

  /**
   * Directly add a team member (ideal for retail staff, cashiers, and managers)
   */
  async addMember(
    businessId: string,
    data: {
      fullName: string;
      email: string;
      phone?: string;
      role: MemberRole;
      pin?: string;
    },
    currentUserId?: string
  ): Promise<TeamMember> {
    const localKey = `${MEMBERS_KEY_PREFIX}${businessId}`;
    let currentMembers: TeamMember[] = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) currentMembers = JSON.parse(stored);
    } catch {}

    const normalizedEmail = data.email.trim().toLowerCase();
    const existing = currentMembers.find(
      (m) => m.email.toLowerCase() === normalizedEmail
    );
    if (existing) {
      throw new Error(`A team member with email ${data.email} already belongs to this business.`);
    }

    const newUserId = generateUUID();
    const membershipId = generateUUID();
    const now = new Date().toISOString();

    const newMember: TeamMember = {
      id: membershipId,
      userId: newUserId,
      businessId,
      role: data.role,
      fullName: data.fullName.trim(),
      email: normalizedEmail,
      phone: data.phone?.trim() || null,
      joinedAt: now,
      pin: data.pin?.trim() || '1234',
      status: 'active',
      isCurrentUser: false,
    };

    // 1. If Supabase is configured, try creating DB record
    if (isSupabaseConfigured && isValidUUID(businessId)) {
      try {
        // Try finding if user profile already exists
        const { data: existingProfile } = await (supabase as any)
          .from('profiles')
          .select('id, email')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        const targetUserId = existingProfile ? existingProfile.id : newUserId;

        await (supabase as any).from('business_members').insert({
          id: membershipId,
          business_id: businessId,
          user_id: targetUserId,
          role: data.role,
        });
      } catch (err) {
        console.warn('Supabase addMember error, proceeding with resilient local storage:', err);
      }
    }

    // 2. Update local storage
    currentMembers.push(newMember);
    this.saveLocalMembers(businessId, currentMembers);

    return newMember;
  },

  /**
   * Update a member's role
   */
  async updateMemberRole(
    businessId: string,
    memberId: string,
    newRole: MemberRole,
    currentUserId?: string
  ): Promise<TeamMember> {
    const localKey = `${MEMBERS_KEY_PREFIX}${businessId}`;
    let currentMembers: TeamMember[] = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) currentMembers = JSON.parse(stored);
    } catch {}

    const targetIndex = currentMembers.findIndex((m) => m.id === memberId || m.userId === memberId);
    if (targetIndex === -1) {
      throw new Error('Team member not found.');
    }

    const targetMember = currentMembers[targetIndex];

    // Safety guard: Cannot demote the last remaining owner
    if (targetMember.role === 'owner' && newRole !== 'owner') {
      const ownerCount = currentMembers.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        throw new Error('Cannot change role: A business must have at least one active Owner.');
      }
    }

    // 1. Supabase update
    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(targetMember.id)) {
      try {
        await (supabase as any)
          .from('business_members')
          .update({ role: newRole })
          .eq('id', targetMember.id);
      } catch (err) {
        console.warn('Supabase updateMemberRole error:', err);
      }
    }

    // 2. Local update
    targetMember.role = newRole;
    currentMembers[targetIndex] = targetMember;
    this.saveLocalMembers(businessId, currentMembers);

    return targetMember;
  },

  /**
   * Update a member's POS authorization PIN
   */
  async updateMemberPin(
    businessId: string,
    memberId: string,
    pin: string
  ): Promise<TeamMember> {
    const localKey = `${MEMBERS_KEY_PREFIX}${businessId}`;
    let currentMembers: TeamMember[] = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) currentMembers = JSON.parse(stored);
    } catch {}

    const targetIndex = currentMembers.findIndex((m) => m.id === memberId || m.userId === memberId);
    if (targetIndex === -1) {
      throw new Error('Team member not found.');
    }

    currentMembers[targetIndex].pin = pin.trim();
    this.saveLocalMembers(businessId, currentMembers);
    return currentMembers[targetIndex];
  },

  /**
   * Remove a member from the business
   */
  async removeMember(
    businessId: string,
    memberId: string,
    currentUserId?: string
  ): Promise<void> {
    const localKey = `${MEMBERS_KEY_PREFIX}${businessId}`;
    let currentMembers: TeamMember[] = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) currentMembers = JSON.parse(stored);
    } catch {}

    const target = currentMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!target) {
      throw new Error('Team member not found.');
    }

    // Prevent removing the sole owner
    if (target.role === 'owner') {
      const ownerCount = currentMembers.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        throw new Error('Cannot remove member: A business must have at least one active Owner.');
      }
    }

    // 1. Supabase deletion
    if (isSupabaseConfigured && isValidUUID(businessId) && isValidUUID(target.id)) {
      try {
        await (supabase as any)
          .from('business_members')
          .delete()
          .eq('id', target.id);
      } catch (err) {
        console.warn('Supabase removeMember error:', err);
      }
    }

    // 2. Local deletion
    currentMembers = currentMembers.filter((m) => m.id !== memberId && m.userId !== memberId);
    this.saveLocalMembers(businessId, currentMembers);
  },

  /**
   * Create an email/shareable invitation
   */
  async createInvitation(
    businessId: string,
    businessName: string,
    inviter: { id: string; name: string },
    data: {
      email: string;
      fullName: string;
      role: MemberRole;
      pin?: string;
    }
  ): Promise<TeamInvitation> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const invitesKey = `${INVITES_KEY_PREFIX}${businessId}`;

    let currentInvites: TeamInvitation[] = [];
    try {
      const stored = localStorage.getItem(invitesKey);
      if (stored) currentInvites = JSON.parse(stored);
    } catch {}

    // Check if already invited
    const existing = currentInvites.find(
      (inv) => inv.email.toLowerCase() === normalizedEmail && inv.status === 'pending'
    );
    if (existing) {
      return existing;
    }

    // Generate random friendly invite code (e.g. URS-7841)
    const codeNum = Math.floor(1000 + Math.random() * 9000);
    const inviteCode = `URS-${codeNum}`;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const newInvite: TeamInvitation = {
      id: generateUUID(),
      businessId,
      businessName,
      email: normalizedEmail,
      fullName: data.fullName.trim(),
      role: data.role,
      pin: data.pin?.trim() || '1234',
      invitedByUserId: inviter.id,
      invitedByUserName: inviter.name,
      inviteCode,
      createdAt: now.toISOString(),
      expiresAt,
      status: 'pending',
    };

    currentInvites.push(newInvite);
    try {
      localStorage.setItem(invitesKey, JSON.stringify(currentInvites));

      // Also register in global invites lookup for redemption
      let globalInvites: TeamInvitation[] = [];
      const globalStored = localStorage.getItem(GLOBAL_INVITES_KEY);
      if (globalStored) globalInvites = JSON.parse(globalStored);
      globalInvites.push(newInvite);
      localStorage.setItem(GLOBAL_INVITES_KEY, JSON.stringify(globalInvites));
    } catch (e) {
      console.warn('Failed to store team invitation:', e);
    }

    return newInvite;
  },

  /**
   * Get pending invitations for a business
   */
  getInvitations(businessId: string): TeamInvitation[] {
    const invitesKey = `${INVITES_KEY_PREFIX}${businessId}`;
    try {
      const stored = localStorage.getItem(invitesKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  },

  /**
   * Revoke an invitation
   */
  revokeInvitation(businessId: string, inviteId: string) {
    const invitesKey = `${INVITES_KEY_PREFIX}${businessId}`;
    try {
      const stored = localStorage.getItem(invitesKey);
      if (stored) {
        let currentInvites: TeamInvitation[] = JSON.parse(stored);
        currentInvites = currentInvites.filter((i) => i.id !== inviteId);
        localStorage.setItem(invitesKey, JSON.stringify(currentInvites));
      }
    } catch {}
  },

  /**
   * Redeem/Accept an invite code by an authenticated user
   */
  async acceptInviteCode(
    inviteCode: string,
    user: { id: string; email: string; fullName?: string }
  ): Promise<{ businessId: string; role: MemberRole; businessName: string }> {
    const cleanCode = inviteCode.trim().toUpperCase();

    // 1. Search in global invites registry
    let globalInvites: TeamInvitation[] = [];
    try {
      const globalStored = localStorage.getItem(GLOBAL_INVITES_KEY);
      if (globalStored) globalInvites = JSON.parse(globalStored);
    } catch {}

    const match = globalInvites.find(
      (inv) => inv.inviteCode.toUpperCase() === cleanCode && inv.status === 'pending'
    );

    if (!match) {
      throw new Error('Invalid or expired invitation code. Please verify with your business administrator.');
    }

    // 2. Add user to business_members in Supabase if online
    if (isSupabaseConfigured && isValidUUID(match.businessId)) {
      try {
        await (supabase as any).from('business_members').insert({
          id: generateUUID(),
          business_id: match.businessId,
          user_id: user.id,
          role: match.role,
        });
      } catch (err) {
        console.warn('Supabase acceptInvite insert error:', err);
      }
    }

    // 3. Add to business members locally
    await this.addMember(match.businessId, {
      fullName: user.fullName || match.fullName || 'Team Member',
      email: user.email,
      role: match.role,
      pin: match.pin || '1234',
    }, user.id);

    // 4. Mark invite as accepted
    match.status = 'accepted';
    try {
      localStorage.setItem(GLOBAL_INVITES_KEY, JSON.stringify(globalInvites));
      // Update business specific invites
      const businessInvites = this.getInvitations(match.businessId);
      const bizMatch = businessInvites.find((i) => i.id === match.id);
      if (bizMatch) {
        bizMatch.status = 'accepted';
        localStorage.setItem(`${INVITES_KEY_PREFIX}${match.businessId}`, JSON.stringify(businessInvites));
      }
    } catch {}

    return {
      businessId: match.businessId,
      role: match.role,
      businessName: match.businessName,
    };
  },
};
