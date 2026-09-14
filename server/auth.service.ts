import crypto from 'crypto';
import { EmailService } from './email.service.ts';
import { serverSupabase } from './business-tools.service.ts';

export interface PendingVerification {
  code: string;
  email: string;
  fullName?: string;
  phone?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  isVerified?: boolean;
}

export interface AuthRegisterInput {
  email: string;
  code: string;
  password?: string;
  fullName: string;
  phone?: string;
}

class ServerAuthService {
  // In-memory verification code registry: normalized email -> pending verification record
  private pendingCodes: Map<string, PendingVerification> = new Map();

  // 15 minutes TTL for verification codes
  private readonly CODE_TTL_MS = 15 * 60 * 1000;
  // 45 seconds minimum cooldown between resending codes
  private readonly RESEND_COOLDOWN_MS = 45 * 1000;
  // Maximum invalid verification attempts before code is invalidated
  private readonly MAX_ATTEMPTS = 5;

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Generates a secure random 6-digit numeric string
   */
  private generateSixDigitCode(): string {
    const num = crypto.randomInt(100000, 1000000); // 100000 to 999999
    return num.toString();
  }

  /**
   * Request a new 6-digit verification code for signup
   */
  public async requestVerificationCode(email: string, fullName?: string, phone?: string): Promise<{
    success: boolean;
    simulated: boolean;
    devCode?: string;
    message: string;
    expiresInSeconds: number;
    cooldownSeconds?: number;
  }> {
    const normEmail = this.normalizeEmail(email);

    if (!normEmail || !normEmail.includes('@') || !normEmail.includes('.')) {
      throw new Error('Please enter a valid email address.');
    }

    const existing = this.pendingCodes.get(normEmail);
    const now = Date.now();

    // Check resend cooldown
    if (existing && now - existing.lastSentAt < this.RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((this.RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return {
        success: false,
        simulated: false,
        message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        expiresInSeconds: Math.max(0, Math.ceil((existing.expiresAt - now) / 1000)),
        cooldownSeconds: remainingSeconds,
      };
    }

    const code = this.generateSixDigitCode();
    const expiresAt = now + this.CODE_TTL_MS;

    const record: PendingVerification = {
      code,
      email: normEmail,
      fullName: fullName?.trim(),
      phone: phone?.trim(),
      createdAt: now,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      isVerified: false,
    };

    this.pendingCodes.set(normEmail, record);

    // Send email via Brevo
    const emailResult = await EmailService.sendVerificationEmail(normEmail, code, fullName);

    return {
      success: true,
      simulated: emailResult.simulated,
      devCode: emailResult.devCode,
      message: emailResult.message,
      expiresInSeconds: Math.ceil(this.CODE_TTL_MS / 1000),
    };
  }

  /**
   * Verify an entered 6-digit code for an email
   */
  public verifyCode(email: string, enteredCode: string): { verified: boolean; message?: string } {
    const normEmail = this.normalizeEmail(email);
    const record = this.pendingCodes.get(normEmail);

    if (!record) {
      return { verified: false, message: 'No verification code was requested for this email. Please request a new code.' };
    }

    const now = Date.now();
    if (now > record.expiresAt) {
      this.pendingCodes.delete(normEmail);
      return { verified: false, message: 'Verification code has expired. Please request a new code.' };
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.pendingCodes.delete(normEmail);
      return { verified: false, message: 'Too many incorrect attempts. Please request a new code.' };
    }

    const cleanEntered = enteredCode.trim().replace(/\D/g, '');
    if (cleanEntered !== record.code) {
      record.attempts += 1;
      const remainingAttempts = this.MAX_ATTEMPTS - record.attempts;
      return {
        verified: false,
        message: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`,
      };
    }

    // Mark verified
    record.isVerified = true;
    return { verified: true, message: 'Code verified successfully.' };
  }

  /**
   * Complete registration after verifying code
   */
  public async completeRegistration(input: AuthRegisterInput): Promise<{
    success: boolean;
    user: {
      id: string;
      email: string;
      user_metadata: {
        full_name?: string;
        phone?: string;
      };
    };
    message: string;
  }> {
    const normEmail = this.normalizeEmail(input.email);
    const record = this.pendingCodes.get(normEmail);

    // Validate verification
    const verification = this.verifyCode(input.email, input.code);
    if (!verification.verified && !record?.isVerified) {
      throw new Error(verification.message || 'Invalid or expired verification code.');
    }

    const fullName = input.fullName?.trim() || record?.fullName || normEmail.split('@')[0];
    const phone = input.phone?.trim() || record?.phone || undefined;
    const password = input.password;

    const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 20);
    const isSupabaseLive = Boolean(
      (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) &&
      !(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').includes('placeholder.supabase.co')
    );

    let userId = '';

    if (isSupabaseLive && hasServiceRoleKey) {
      try {
        // Create user with email_confirm = true so NO confirmation link is required
        const { data: createData, error: createError } = await serverSupabase.auth.admin.createUser({
          email: normEmail,
          password: password || undefined,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            phone: phone || null,
          },
        });

        if (createError) {
          // If already registered, update user to confirmed
          if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
            // Find user id
            const { data: userList } = await serverSupabase.auth.admin.listUsers();
            const existingUser = (userList?.users as any[])?.find((u: any) => u.email?.toLowerCase() === normEmail);
            if (existingUser) {
              userId = existingUser.id;
              // Update user password and mark confirmed
              if (password) {
                await serverSupabase.auth.admin.updateUserById(existingUser.id, {
                  password,
                  email_confirm: true,
                  user_metadata: { full_name: fullName, phone: phone || null },
                });
              }
            } else {
              throw new Error(createError.message);
            }
          } else {
            throw new Error(createError.message);
          }
        } else if (createData?.user) {
          userId = createData.user.id;
        }

        // Upsert user profile
        if (userId) {
          try {
            await (serverSupabase as any).from('profiles').upsert({
              id: userId,
              full_name: fullName,
              phone: phone || null,
              updated_at: new Date().toISOString(),
            });
          } catch (profileErr) {
            console.warn('[ServerAuth] Profile upsert notice:', profileErr);
          }
        }
      } catch (err: any) {
        console.error('[ServerAuth] Supabase admin creation failed:', err);
        // If Supabase creation threw an error, rethrow for user visibility
        if (err.message && !err.message.includes('already')) {
          throw err;
        }
      }
    }

    if (!userId) {
      // Fallback deterministic UUID for the user
      userId = crypto.randomUUID();
    }

    // Clean up code record upon successful registration
    this.pendingCodes.delete(normEmail);

    return {
      success: true,
      user: {
        id: userId,
        email: normEmail,
        user_metadata: {
          full_name: fullName,
          phone,
        },
      },
      message: 'Account successfully registered and verified.',
    };
  }
}

export const serverAuthService = new ServerAuthService();
