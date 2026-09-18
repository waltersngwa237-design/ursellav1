/**
 * Brevo (Sendinblue) Transactional Email Service
 * Handles transactional emails, 6-digit signup verification codes,
 * and security alerts using Brevo's REST API v3 (POST https://api.brevo.com/v3/smtp/email).
 */

export interface SendEmailResult {
  success: boolean;
  simulated: boolean;
  messageId?: string;
  devCode?: string;
  message: string;
}

export class EmailService {
  private static readonly BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

  public static isBrevoConfigured(): boolean {
    const key = process.env.BREVO_API_KEY?.trim();
    return Boolean(key && key.length > 10 && !key.includes('your-brevo-api-key'));
  }

  public static getSenderInfo() {
    return {
      name: process.env.BREVO_SENDER_NAME || 'Ursella Business OS',
      email: process.env.BREVO_SENDER_EMAIL || 'no-reply@ursella.app',
    };
  }

  /**
   * Send a 6-digit verification code email via Brevo REST API v3
   */
  public static async sendVerificationEmail(
    toEmail: string,
    code: string,
    recipientName?: string
  ): Promise<SendEmailResult> {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const sender = this.getSenderInfo();
    const name = recipientName?.trim() || toEmail.split('@')[0];

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ursella Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #18181b 0%, #09090b 100%); border-bottom: 1px solid #27272a;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 8px 12px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px;">
                      <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.5px; color: #10b981;">URSELLA</span>
                      <span style="font-size: 12px; font-weight: 600; color: #a1a1aa; margin-left: 6px;">BUSINESS OS</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                Verify your business account
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Hello <strong style="color: #ffffff;">${name}</strong>,<br>
                Thank you for registering with Ursella Business OS. Use the 6-digit verification code below to confirm your email and complete your setup:
              </p>

              <!-- Code Box -->
              <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #10b981; margin-bottom: 8px;">
                  Your Verification Code
                </div>
                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 12px rgba(16, 185, 129, 0.3);">
                  ${code}
                </div>
                <div style="font-size: 12px; color: #71717a; margin-top: 8px;">
                  Valid for 15 minutes • Do not share this code
                </div>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #a1a1aa;">
                If you did not request this verification code, please ignore this message. No changes will be made to your account.
              </p>

              <!-- Security Callout -->
              <div style="margin-top: 24px; padding: 14px; background-color: rgba(39, 39, 42, 0.5); border-left: 3px solid #10b981; border-radius: 6px; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                <strong style="color: #ffffff;">Security Tip:</strong> Ursella administrators will never call or message you asking for your verification code or password.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #09090b; border-top: 1px solid #27272a; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #71717a;">
                Ursella Enterprise Cloud • Douala, Cameroon • West & Central Africa
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                Automated security notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = `
Hello ${name},

Your Ursella Business OS verification code is: ${code}

This code will expire in 15 minutes. Enter it on the verification screen to activate your account.

If you did not request this code, you can safely ignore this email.
--
Ursella Business OS
    `.trim();

    // If Brevo is configured with an active API key, dispatch via HTTP POST
    if (this.isBrevoConfigured() && apiKey) {
      try {
        console.log(`[Brevo Email Service] Dispatching verification code to ${toEmail} via Brevo API v3...`);

        const response = await fetch(this.BREVO_API_URL, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: sender.name,
              email: sender.email,
            },
            to: [
              {
                email: toEmail,
                name,
              },
            ],
            subject: `Your Ursella Verification Code: ${code}`,
            htmlContent,
            textContent,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Brevo Email Service Error] Status ${response.status}:`, errText);

          // Fallback to simulated delivery for dev/testing if sender is unverified or API limits exceeded
          return {
            success: true,
            simulated: true,
            devCode: code,
            message: `Brevo API returned status ${response.status}. Verification code generated in sandbox mode: ${code}`,
          };
        }

        const data = (await response.json()) as { messageId?: string };
        console.log(`[Brevo Email Service] Email sent successfully! MessageId: ${data?.messageId || 'ok'}`);

        return {
          success: true,
          simulated: false,
          messageId: data?.messageId,
          message: 'Verification code sent to your email address.',
        };
      } catch (err: any) {
        console.error('[Brevo Email Service] Network error calling Brevo:', err);
        return {
          success: true,
          simulated: true,
          devCode: code,
          message: 'Network issue contacting Brevo. Verification code generated in sandbox mode.',
        };
      }
    }

    // Sandbox / Preview mode (No Brevo API key set in environment)
    console.log(`[Brevo Email Service] (SANDBOX / DEV MODE) Verification code for ${toEmail}: ${code}`);
    return {
      success: true,
      simulated: true,
      devCode: code,
      message: `(Sandbox Preview) Verification code for ${toEmail} is ${code}`,
    };
  }

  /**
   * Send a 6-digit password reset verification code email via Brevo REST API v3
   */
  public static async sendPasswordResetEmail(
    toEmail: string,
    code: string,
    recipientName?: string
  ): Promise<SendEmailResult> {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const sender = this.getSenderInfo();
    const name = recipientName?.trim() || toEmail.split('@')[0];

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Ursella Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, #18181b 0%, #09090b 100%); border-bottom: 1px solid #27272a;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 8px 12px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px;">
                      <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.5px; color: #10b981;">URSELLA</span>
                      <span style="font-size: 12px; font-weight: 600; color: #a1a1aa; margin-left: 6px;">BUSINESS OS</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                Password Reset Request
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                Hello <strong style="color: #ffffff;">${name}</strong>,<br>
                We received a request to reset the password for your Ursella Business OS account. Use the 6-digit verification code below to authorize this change:
              </p>

              <!-- Code Box -->
              <div style="background-color: #09090b; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #10b981; margin-bottom: 8px;">
                  Password Reset Code
                </div>
                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; text-shadow: 0 0 12px rgba(16, 185, 129, 0.3);">
                  ${code}
                </div>
                <div style="font-size: 12px; color: #71717a; margin-top: 8px;">
                  Valid for 15 minutes • Single use only
                </div>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #a1a1aa;">
                If you did not request a password reset, please ignore this email or review your account credentials immediately. Your password has not been changed yet.
              </p>

              <!-- Security Callout -->
              <div style="margin-top: 24px; padding: 14px; background-color: rgba(39, 39, 42, 0.5); border-left: 3px solid #e11d48; border-radius: 6px; font-size: 12px; color: #a1a1aa; line-height: 1.5;">
                <strong style="color: #ffffff;">Security Alert:</strong> Never share this code with anyone. Ursella security team members will never ask for your verification code or password over phone or chat.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #09090b; border-top: 1px solid #27272a; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #71717a;">
                Ursella Enterprise Cloud • Douala, Cameroon • West & Central Africa
              </p>
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                Automated security notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const textContent = `
Hello ${name},

Your Ursella Business OS password reset code is: ${code}

This code will expire in 15 minutes. Enter it on the password reset screen to set a new password.

If you did not request this password reset, you can safely ignore this email. No changes will be made to your account.
--
Ursella Business OS Security Team
    `.trim();

    if (this.isBrevoConfigured() && apiKey) {
      try {
        console.log(`[Brevo Email Service] Dispatching password reset code to ${toEmail} via Brevo API v3...`);

        const response = await fetch(this.BREVO_API_URL, {
          method: 'POST',
          headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: sender.name,
              email: sender.email,
            },
            to: [
              {
                email: toEmail,
                name,
              },
            ],
            subject: `Your Ursella Password Reset Code: ${code}`,
            htmlContent,
            textContent,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Brevo Email Service Error] Status ${response.status}:`, errText);

          return {
            success: true,
            simulated: true,
            devCode: code,
            message: `Reset code generated in sandbox mode: ${code}`,
          };
        }

        const data = (await response.json()) as { messageId?: string };
        console.log(`[Brevo Email Service] Reset code email sent successfully! MessageId: ${data?.messageId || 'ok'}`);

        return {
          success: true,
          simulated: false,
          messageId: data?.messageId,
          message: 'Password reset code sent to your email address.',
        };
      } catch (err: any) {
        console.error('[Brevo Email Service] Network error calling Brevo:', err);
        return {
          success: true,
          simulated: true,
          devCode: code,
          message: 'Network issue sending reset code. Reset code generated in sandbox mode.',
        };
      }
    }

    // Sandbox / Preview mode
    console.log(`[Brevo Email Service] (SANDBOX / DEV MODE) Password reset code for ${toEmail}: ${code}`);
    return {
      success: true,
      simulated: true,
      devCode: code,
      message: `(Sandbox Preview) Password reset code for ${toEmail} is ${code}`,
    };
  }
}
