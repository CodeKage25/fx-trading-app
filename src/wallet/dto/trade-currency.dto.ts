import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsUppercase, Length, IsOptional } from 'class-validator';

export class TradeCurrencyDto {
  @ApiProperty({ example: 'NGN', description: 'Currency you are selling' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ example: 'USD', description: 'Currency you are buying' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  toCurrency: string;

  @ApiProperty({ example: 5000, description: 'Amount in source currency to trade' })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'trade-ref-001', required: false })
  @IsOptional()
  @IsString()
  reference?: string;
}
