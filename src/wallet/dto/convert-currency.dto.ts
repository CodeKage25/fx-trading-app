import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsUppercase, Length, IsOptional } from 'class-validator';

export class ConvertCurrencyDto {
  @ApiProperty({ example: 'NGN', description: 'Source currency' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ example: 'USD', description: 'Target currency' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  toCurrency: string;

  @ApiProperty({ example: 1000, description: 'Amount in source currency to convert' })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'ref-abc123', required: false })
  @IsOptional()
  @IsString()
  reference?: string;
}
