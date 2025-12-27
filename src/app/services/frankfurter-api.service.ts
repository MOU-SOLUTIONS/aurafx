// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, shareReplay, retry } from 'rxjs/operators';
import { ExchangeRate, HistoricalRate } from '../models/currency.model';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class FrankfurterApiService {
  private readonly baseUrl = 'https://api.frankfurter.dev/v1';
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTimeout = 5 * 60 * 1000;
  private readonly maxCacheSize = 100;
  private readonly retryAttempts = 2;

  constructor(private readonly http: HttpClient) {
    this.cleanupCache();
  }

  getLatestRates(base: string = 'EUR', symbols?: string[]): Observable<ExchangeRate> {
    const sanitizedBase = this.sanitizeCurrencyCode(base);
    const sanitizedSymbols = this.sanitizeCurrencyArray(symbols);
    const cacheKey = this.buildCacheKey('latest', sanitizedBase, sanitizedSymbols);
    
    const cached = this.getCached<ExchangeRate>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = this.buildParams(sanitizedBase, sanitizedSymbols);

    return this.http.get<ExchangeRate>(`${this.baseUrl}/latest`, { params }).pipe(
      retry(this.retryAttempts),
      map(data => this.validateExchangeRate(data, sanitizedBase)),
      map(data => {
        this.setCache(cacheKey, data);
        return data;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(() => this.getFallbackExchangeRate(sanitizedBase))
    );
  }

  getHistoricalRate(date: string, base: string = 'EUR', symbols?: string[]): Observable<ExchangeRate> {
    const sanitizedDate = this.sanitizeDate(date);
    const sanitizedBase = this.sanitizeCurrencyCode(base);
    const sanitizedSymbols = this.sanitizeCurrencyArray(symbols);
    const cacheKey = this.buildCacheKey('historical', sanitizedDate, sanitizedBase, sanitizedSymbols);
    
    const cached = this.getCached<ExchangeRate>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = this.buildParams(sanitizedBase, sanitizedSymbols);

    return this.http.get<ExchangeRate>(`${this.baseUrl}/${sanitizedDate}`, { params }).pipe(
      retry(this.retryAttempts),
      map(data => this.validateExchangeRate(data, sanitizedBase)),
      map(data => {
        this.setCache(cacheKey, data);
        return data;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(() => this.getFallbackExchangeRate(sanitizedBase))
    );
  }

  getTimeSeries(startDate: string, endDate?: string, base: string = 'EUR', symbols?: string[]): Observable<HistoricalRate> {
    const sanitizedStartDate = this.sanitizeDate(startDate);
    const sanitizedEndDate = endDate ? this.sanitizeDate(endDate) : undefined;
    const sanitizedBase = this.sanitizeCurrencyCode(base);
    const sanitizedSymbols = this.sanitizeCurrencyArray(symbols);
    const dateRange = sanitizedEndDate ? `${sanitizedStartDate}..${sanitizedEndDate}` : `${sanitizedStartDate}..`;
    const cacheKey = this.buildCacheKey('timeseries', dateRange, sanitizedBase, sanitizedSymbols);
    
    const cached = this.getCached<HistoricalRate>(cacheKey);
    if (cached) {
      return of(cached);
    }

    const params = this.buildParams(sanitizedBase, sanitizedSymbols);

    return this.http.get<HistoricalRate>(`${this.baseUrl}/${dateRange}`, { params }).pipe(
      retry(this.retryAttempts),
      map(data => this.validateHistoricalRate(data, sanitizedBase)),
      map(data => {
        this.setCache(cacheKey, data);
        return data;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(() => this.getFallbackHistoricalRate(sanitizedBase, sanitizedStartDate, sanitizedEndDate))
    );
  }

  getCurrencies(): Observable<Record<string, string>> {
    const cacheKey = 'currencies';
    const cached = this.getCached<Record<string, string>>(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.http.get<Record<string, string>>(`${this.baseUrl}/currencies`).pipe(
      retry(this.retryAttempts),
      map(data => this.validateCurrencies(data)),
      map(data => {
        this.setCache(cacheKey, data);
        return data;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      catchError(() => of({}))
    );
  }

  convertCurrency(from: string, to: string, amount: number): Observable<number> {
    const sanitizedFrom = this.sanitizeCurrencyCode(from);
    const sanitizedTo = this.sanitizeCurrencyCode(to);
    const sanitizedAmount = this.sanitizeAmount(amount);

    if (sanitizedAmount <= 0) {
      return of(0);
    }

    return this.getLatestRates(sanitizedFrom, [sanitizedTo]).pipe(
      map(data => {
        const rate = data.rates[sanitizedTo];
        if (!rate || !isFinite(rate) || rate <= 0) {
          return 0;
        }
        const result = sanitizedAmount * rate;
        return isFinite(result) ? result : 0;
      }),
      catchError(() => of(0))
    );
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCacheEntry();
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  private buildCacheKey(...parts: (string | string[] | undefined)[]): string {
    const sanitized = parts
      .map(part => {
        if (Array.isArray(part)) {
          return part.length > 0 ? part.join(',') : 'all';
        }
        return part || '';
      })
      .filter(p => p.length > 0)
      .join('_');
    
    return sanitized.slice(0, 200);
  }

  private buildParams(base: string, symbols?: string[]): HttpParams {
    let params = new HttpParams().set('base', base);
    if (symbols && symbols.length > 0) {
      params = params.set('symbols', symbols.join(','));
    }
    return params;
  }

  private validateExchangeRate(data: unknown, base: string): ExchangeRate {
    if (!data || typeof data !== 'object') {
      return this.createEmptyExchangeRate(base);
    }

    const rate = data as ExchangeRate;
    if (!rate.base || !rate.rates || typeof rate.rates !== 'object') {
      return this.createEmptyExchangeRate(base);
    }

    const sanitizedRates: Record<string, number> = {};
    for (const [key, value] of Object.entries(rate.rates)) {
      const sanitizedKey = this.sanitizeCurrencyCode(key);
      const numValue = Number(value);
      if (sanitizedKey && isFinite(numValue) && numValue > 0) {
        sanitizedRates[sanitizedKey] = numValue;
      }
    }

    return {
      base: this.sanitizeCurrencyCode(rate.base) || base,
      date: typeof rate.date === 'string' ? this.sanitizeDate(rate.date) : new Date().toISOString().split('T')[0],
      rates: sanitizedRates
    };
  }

  private validateHistoricalRate(data: unknown, base: string): HistoricalRate {
    if (!data || typeof data !== 'object') {
      return this.createEmptyHistoricalRate(base);
    }

    const rate = data as HistoricalRate;
    if (!rate.base || !rate.rates || typeof rate.rates !== 'object') {
      return this.createEmptyHistoricalRate(base);
    }

    const sanitizedRates: Record<string, Record<string, number>> = {};
    for (const [date, currencies] of Object.entries(rate.rates)) {
      if (typeof currencies === 'object' && currencies !== null) {
        const sanitizedCurrencies: Record<string, number> = {};
        for (const [code, value] of Object.entries(currencies)) {
          const sanitizedCode = this.sanitizeCurrencyCode(code);
          const numValue = Number(value);
          if (sanitizedCode && isFinite(numValue) && numValue > 0) {
            sanitizedCurrencies[sanitizedCode] = numValue;
          }
        }
        if (Object.keys(sanitizedCurrencies).length > 0) {
          sanitizedRates[this.sanitizeDate(date)] = sanitizedCurrencies;
        }
      }
    }

    return {
      base: this.sanitizeCurrencyCode(rate.base) || base,
      start_date: typeof rate.start_date === 'string' ? this.sanitizeDate(rate.start_date) : '',
      end_date: typeof rate.end_date === 'string' ? this.sanitizeDate(rate.end_date) : '',
      rates: sanitizedRates
    };
  }

  private validateCurrencies(data: unknown): Record<string, string> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const currencies: Record<string, string> = {};
    for (const [code, name] of Object.entries(data)) {
      const sanitizedCode = this.sanitizeCurrencyCode(code);
      const sanitizedName = this.sanitizeString(name);
      if (sanitizedCode && sanitizedName) {
        currencies[sanitizedCode] = sanitizedName;
      }
    }

    return currencies;
  }

  private getFallbackExchangeRate(base: string): Observable<ExchangeRate> {
    return of(this.createEmptyExchangeRate(base));
  }

  private getFallbackHistoricalRate(base: string, startDate: string, endDate?: string): Observable<HistoricalRate> {
    return of(this.createEmptyHistoricalRate(base, startDate, endDate));
  }

  private createEmptyExchangeRate(base: string): ExchangeRate {
    return {
      base: this.sanitizeCurrencyCode(base) || 'EUR',
      date: new Date().toISOString().split('T')[0],
      rates: {}
    };
  }

  private createEmptyHistoricalRate(base: string, startDate?: string, endDate?: string): HistoricalRate {
    return {
      base: this.sanitizeCurrencyCode(base) || 'EUR',
      start_date: startDate ? this.sanitizeDate(startDate) : '',
      end_date: endDate ? this.sanitizeDate(endDate) : '',
      rates: {}
    };
  }

  private sanitizeCurrencyCode(code: unknown): string {
    if (typeof code !== 'string' || !code) {
      return 'EUR';
    }
    const sanitized = code.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    return /^[A-Z]{3}$/.test(sanitized) ? sanitized : 'EUR';
  }

  private sanitizeCurrencyArray(codes: unknown): string[] {
    if (!Array.isArray(codes)) {
      return [];
    }
    const sanitized = codes
      .map(code => this.sanitizeCurrencyCode(code))
      .filter(code => /^[A-Z]{3}$/.test(code));
    
    return Array.from(new Set(sanitized));
  }

  private sanitizeDate(date: unknown): string {
    if (typeof date !== 'string' || !date) {
      return new Date().toISOString().split('T')[0];
    }
    const sanitized = date.trim().replace(/[^0-9-]/g, '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
      return new Date().toISOString().split('T')[0];
    }
    const dateObj = new Date(sanitized);
    if (isNaN(dateObj.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return sanitized;
  }

  private sanitizeAmount(amount: unknown): number {
    if (typeof amount === 'number' && isFinite(amount) && amount >= 0) {
      return amount;
    }
    if (typeof amount === 'string') {
      const parsed = parseFloat(amount);
      if (isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 0;
  }

  private sanitizeString(input: unknown): string {
    if (typeof input !== 'string' || !input) {
      return '';
    }
    return input.trim().replace(/[<>\"'&]/g, '').slice(0, 100);
  }
}
