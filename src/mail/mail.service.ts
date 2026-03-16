import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendOtp(email: string, otpCode: string): Promise<void> {
    const from = this.configService.get<string>('MAIL_FROM');

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'FX Trading App — Email Verification OTP',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #2d3748;">Verify your email address</h2>
            <p>Use the OTP below to verify your account. It expires in <strong>10 minutes</strong>.</p>
            <div style="background: #edf2f7; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2b6cb0;">${otpCode}</span>
            </div>
            <p style="color: #718096; font-size: 14px;">
              If you did not create an account, please ignore this email.
            </p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${email}`, err);
      throw err;
    }
  }
}
