import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { FxService } from './fx.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string, defaultVal?: any) => {
    const config: Record<string, any> = {
      FX_API_KEY: 'test-key',
      FX_API_BASE_URL: 'https://v6.exchangerate-api.com/v6',
      FX_CACHE_TTL: 60000,
      SUPPORTED_CURRENCIES: 'NGN,USD,EUR,GBP,CAD,JPY',
    };
    return config[key] ?? defaultVal;
  }),
});

describe('FxService', () => {
  let service: FxService;
  let cacheManager: ReturnType<typeof mockCacheManager>;

  beforeEach(async () => {
    cacheManager = mockCacheManager();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxService,
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<FxService>(FxService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRates', () => {
    it('returns cached rates when available', async () => {
      const cachedData = {
        base: 'NGN',
        rates: { USD: 0.00065, EUR: 0.00060 },
        fetchedAt: new Date().toISOString(),
      };
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getRates('NGN');

      expect(result).toEqual(cachedData);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('fetches from API and caches result when cache is empty', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({
        data: {
          result: 'success',
          conversion_rates: { USD: 0.00065, EUR: 0.00060, GBP: 0.00052 },
        },
      });

      const result = await service.getRates('NGN');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(cacheManager.set).toHaveBeenCalledTimes(1);
      expect(result.rates.USD).toBe(0.00065);
    });

    it('returns last known rates as fallback when API fails', async () => {
      // First call: successful, sets lastKnownRates
      cacheManager.get.mockResolvedValueOnce(null);
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          result: 'success',
          conversion_rates: { USD: 0.00065, EUR: 0.00060 },
        },
      });
      await service.getRates('NGN');

      // Second call: cache miss, API fails
      cacheManager.get.mockResolvedValueOnce(null);
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getRates('NGN');

      expect(result.rates.USD).toBe(0.00065); // stale fallback
    });

    it('throws ServiceUnavailableException when API fails and no cached fallback', async () => {
      cacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getRates('NGN')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getRate', () => {
    beforeEach(() => {
      cacheManager.get.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({
        data: {
          result: 'success',
          conversion_rates: {
            NGN: 1,
            USD: 0.00065,
            EUR: 0.0006,
            GBP: 0.00052,
          },
        },
      });
    });

    it('returns 1 for same currency', async () => {
      const rate = await service.getRate('NGN', 'NGN');
      expect(rate).toBe(1);
    });

    it('returns correct NGN → USD rate', async () => {
      const rate = await service.getRate('NGN', 'USD');
      expect(rate).toBe(0.00065);
    });

    it('returns correct USD → NGN rate (inverse)', async () => {
      const rate = await service.getRate('USD', 'NGN');
      expect(rate).toBeCloseTo(1 / 0.00065, 4);
    });

    it('returns correct cross-rate USD → EUR', async () => {
      const rate = await service.getRate('USD', 'EUR');
      expect(rate).toBeCloseTo(0.0006 / 0.00065, 4);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('returns the list of supported currencies', () => {
      const currencies = service.getSupportedCurrencies();
      expect(currencies).toContain('NGN');
      expect(currencies).toContain('USD');
      expect(currencies).toHaveLength(6);
    });
  });
});
