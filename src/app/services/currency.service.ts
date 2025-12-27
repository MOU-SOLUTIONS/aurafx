// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError, shareReplay, distinctUntilChanged, filter } from 'rxjs/operators';
import { FrankfurterApiService } from './frankfurter-api.service';
import { CurrencyData, Currency } from '../models/currency.model';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly baseCurrency$ = new BehaviorSubject<string>('EUR');
  private readonly selectedCurrencies$ = new BehaviorSubject<string[]>(['USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD']);
  private readonly currenciesCache$: Observable<Record<string, string>>;
  private readonly CACHE_SIZE = 1;

  constructor(private readonly apiService: FrankfurterApiService) {
    this.currenciesCache$ = this.apiService.getCurrencies().pipe(
      catchError(() => of({})),
      shareReplay({ bufferSize: this.CACHE_SIZE, refCount: true })
    );
  }

  setBaseCurrency(currency: string): void {
    const sanitized = this.sanitizeCurrencyCode(currency);
    if (sanitized && sanitized !== this.baseCurrency$.value) {
      this.baseCurrency$.next(sanitized);
    }
  }

  getBaseCurrency(): Observable<string> {
    return this.baseCurrency$.asObservable().pipe(
      distinctUntilChanged()
    );
  }

  setSelectedCurrencies(currencies: string[]): void {
    if (!Array.isArray(currencies)) {
      return;
    }
    const sanitized = this.sanitizeCurrencyArray(currencies);
    if (sanitized.length > 0 && JSON.stringify(sanitized) !== JSON.stringify(this.selectedCurrencies$.value)) {
      this.selectedCurrencies$.next(sanitized);
    }
  }

  getSelectedCurrencies(): Observable<string[]> {
    return this.selectedCurrencies$.asObservable().pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    );
  }

  getCurrencyData(): Observable<CurrencyData[]> {
    return combineLatest([
      this.baseCurrency$.pipe(distinctUntilChanged()),
      this.selectedCurrencies$.pipe(distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))),
      this.currenciesCache$
    ]).pipe(
      filter(([base, symbols]) => this.isValidCurrencyCode(base) && symbols.length > 0),
      switchMap(([base, symbols, currencyMap]) => {
        const sanitizedSymbols = this.sanitizeCurrencyArray(symbols);
        if (sanitizedSymbols.length === 0) {
          return of([]);
        }

        return combineLatest([
          this.apiService.getLatestRates(base, sanitizedSymbols).pipe(
            catchError(() => of(null))
          ),
          this.apiService.getHistoricalRate(this.getYesterdayDate(), base, sanitizedSymbols).pipe(
            catchError(() => of(null))
          )
        ]).pipe(
          map(([latest, historical]) => {
            if (!latest || !historical || !latest.rates || !historical.rates) {
              return [];
            }

            const result: CurrencyData[] = [];

            for (const code of sanitizedSymbols) {
              const currentRateValue = latest.rates[code];
              const previousRateValue = historical.rates[code];

              if (currentRateValue === undefined || previousRateValue === undefined) {
                continue;
              }

              const currentRate = Number(currentRateValue);
              const previousRate = Number(previousRateValue);

              if (!isFinite(currentRate) || !isFinite(previousRate) || currentRate <= 0 || previousRate <= 0) {
                continue;
              }

              const change = currentRate - previousRate;
              const changePercent = previousRate !== 0 ? (change / previousRate) * 100 : 0;

              const currencyData: CurrencyData = {
                code: this.sanitizeCurrencyCode(code),
                name: this.sanitizeString(currencyMap[code] || code),
                rate: currentRate
              };

              if (isFinite(change)) {
                currencyData.change24h = change;
              }

              if (isFinite(changePercent)) {
                currencyData.changePercent24h = changePercent;
              }

              result.push(currencyData);
            }

            return result;
          }),
          catchError(() => of([]))
        );
      }),
      shareReplay({ bufferSize: this.CACHE_SIZE, refCount: true })
    );
  }

  getAvailableCurrencies(): Observable<Currency[]> {
    return this.currenciesCache$.pipe(
      map(currencies => {
        if (!currencies || typeof currencies !== 'object') {
          return [];
        }

        return Object.entries(currencies)
          .map(([code, name]) => ({
            code: this.sanitizeCurrencyCode(code),
            name: this.sanitizeString(name)
          }))
          .filter(currency => currency.code && currency.name);
      }),
      catchError(() => of([])),
      shareReplay({ bufferSize: this.CACHE_SIZE, refCount: true })
    );
  }

  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    return yesterday.toISOString().split('T')[0];
  }

  private sanitizeCurrencyCode(code: unknown): string {
    if (typeof code !== 'string' || !code) {
      return 'EUR';
    }
    const sanitized = code.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    return this.isValidCurrencyCode(sanitized) ? sanitized : 'EUR';
  }

  private sanitizeCurrencyArray(codes: unknown): string[] {
    if (!Array.isArray(codes)) {
      return [];
    }
    const sanitized = codes
      .map(code => this.sanitizeCurrencyCode(code))
      .filter(code => this.isValidCurrencyCode(code));
    
    const unique = Array.from(new Set(sanitized));
    return unique.length > 0 ? unique : ['USD'];
  }

  private sanitizeString(input: unknown): string {
    if (typeof input !== 'string' || !input) {
      return '';
    }
    return input.trim().replace(/[<>\"'&]/g, '').slice(0, 100);
  }

  private isValidCurrencyCode(code: string): boolean {
    return /^[A-Z]{3}$/.test(code);
  }
}
