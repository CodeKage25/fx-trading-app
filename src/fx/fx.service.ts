import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import axios from 'axios';

export interface FxRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);
  private readonly supportedCurrencies: string[];
  private lastKnownRates: FxRates | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.supportedCurrencies = this.configService
      .get<string>('SUPPORTED_CURRENCIES', 'NGN,USD,EUR,GBP,CAD,JPY')
      .split(',')
      .map((c) => c.trim());
  }

  /**
   * Fetches exchange rates relative to NGN from cache, or live API.
   * Falls back to last known rates on API failure.
   */
  async getRates(base = 'NGN'): Promise<FxRates> {
    const cacheKey = `fx_rates_${base}`;
    const cached = await this.cacheManager.get<FxRates>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const rates = await this.fetchFromApi(base);
      await this.cacheManager.set(
        cacheKey,
        rates,
        this.configService.get<number>('FX_CACHE_TTL', 60000),
      );
      this.lastKnownRates = rates;
      return rates;
    } catch (err) {
      this.logger.warn(
        `FX API request failed: ${err.message}. Attempting fallback.`,
      );

      if (this.lastKnownRates) {
        this.logger.warn('Returning stale FX rates as fallback.');
        return this.lastKnownRates;
      }

      throw new ServiceUnavailableException(
        'FX rate service is unavailable. Please try again later.',
      );
    }
  }

  /**
   * Returns the exchange rate to convert `from` → `to`.
   * All rates are fetched relative to NGN, cross-rates are calculated.
   */
  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    // Always fetch rates based on NGN as the base for consistency
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    // Get NGN-based rates
    const data = await this.getRates('NGN');
    const rates = data.rates;

    if (fromUpper === 'NGN') {
      const rate = rates[toUpper];
      if (!rate) throw new ServiceUnavailableException(`Rate for ${toUpper} not available`);
      return rate;
    }

    if (toUpper === 'NGN') {
      const fromRate = rates[fromUpper];
      if (!fromRate) throw new ServiceUnavailableException(`Rate for ${fromUpper} not available`);
      return 1 / fromRate;
    }

    // Cross-rate: from → NGN → to
    const fromRate = rates[fromUpper];
    const toRate = rates[toUpper];
    if (!fromRate) throw new ServiceUnavailableException(`Rate for ${fromUpper} not available`);
    if (!toRate) throw new ServiceUnavailableException(`Rate for ${toUpper} not available`);

    return toRate / fromRate;
  }

  getSupportedCurrencies(): string[] {
    return this.supportedCurrencies;
  }

  private async fetchFromApi(base: string): Promise<FxRates> {
    const apiKey = this.configService.get<string>('FX_API_KEY');
    const baseUrl = this.configService.get<string>('FX_API_BASE_URL');
    const url = `${baseUrl}/${apiKey}/latest/${base}`;

    this.logger.log(`Fetching FX rates from: ${url}`);

    const response = await axios.get(url, { timeout: 5000 });

    if (response.data.result !== 'success') {
      throw new Error(`FX API error: ${response.data['error-type']}`);
    }

    return {
      base,
      rates: response.data.conversion_rates,
      fetchedAt: new Date().toISOString(),
    };
  }
}
