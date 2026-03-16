import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly walletService: WalletService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      otpCode,
      otpExpiresAt,
    });

    await this.mailService.sendOtp(user.email, otpCode);

    return {
      message: 'Registration successful. Check your email for OTP verification.',
      userId: user.id,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified');
    }

    if (!user.otpCode || user.otpCode !== dto.otp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    await this.usersService.save({
      ...user,
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null,
    });

    // Initialize wallets for all supported currencies
    await this.walletService.initializeWallets(user.id);

    const token = this.signToken(user.id, user.email, user.role);

    return {
      message: 'Email verified successfully.',
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Account not verified. Please check your email for OTP.',
      );
    }

    const token = this.signToken(user.id, user.email, user.role);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async resendOtp(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified');
    }

    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersService.save({ ...user, otpCode, otpExpiresAt });
    await this.mailService.sendOtp(user.email, otpCode);

    return { message: 'New OTP sent to your email.' };
  }

  private signToken(userId: string, email: string, role: string): string {
    const secret = this.configService.get<string>('JWT_SECRET') as string;
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.jwtService.sign({ sub: userId, email, role }, { secret, expiresIn: expiresIn as any });
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
