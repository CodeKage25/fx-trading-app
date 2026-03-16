import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsUppercase, Length, IsOptional } from 'class-validator';

export class FundWalletDto {
  @ApiProperty({ example: 'NGN', description: 'Currency to fund (e.g. NGN, USD)' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ example: 10000, description: 'Amount to fund (must be positive)' })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'ref-abc123', required: false, description: 'Idempotency reference (optional, UUID generated if not provided)' })
  @IsOptional()
  @IsString()
  reference?: string;
}
