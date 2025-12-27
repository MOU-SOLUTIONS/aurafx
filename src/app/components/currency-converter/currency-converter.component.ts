// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FrankfurterApiService } from '../../services/frankfurter-api.service';
import { CurrencyService } from '../../services/currency.service';
import { Currency } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';
import { format } from 'date-fns';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface ConversionHistory {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  date: Date;
  historicalDate?: string;
}

interface ConversionResult {
  currency: string;
  amount: number;
  rate: number;
}

@Component({
  selector: 'app-currency-converter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './currency-converter.component.html',
  styleUrl: './currency-converter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrencyConverterComponent implements OnInit {
  private readonly apiService = inject(FrankfurterApiService);
  private readonly currencyService = inject(CurrencyService);
  readonly translation = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly convertSubject = new Subject<void>();

  currencies = signal<Currency[]>([]);
  fromCurrency = signal('EUR');
  toCurrency = signal('USD');
  amount = signal(1);
  result = signal<number | null>(null);
  exchangeRate = signal<number | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  historicalDate = signal<string | null>(null);
  showHistorical = signal(false);
  conversionHistory = signal<ConversionHistory[]>([]);
  favoriteCurrencies = signal<string[]>(['USD', 'GBP', 'JPY', 'CHF', 'AUD']);
  readonly amountPresets = [1, 10, 100, 1000, 10000, 100000] as const;
  multipleTargets = signal<string[]>([]);
  showMultiple = signal(false);
  multipleResults = signal<ConversionResult[]>([]);

  readonly canAddTarget = computed(() => this.multipleTargets().length < 5);
  readonly hasHistory = computed(() => this.conversionHistory().length > 0);
  readonly inverseRate = computed(() => {
    const rate = this.exchangeRate();
    return rate && isFinite(rate) && rate > 0 ? 1 / rate : null;
  });

  constructor() {
    this.loadHistory();
    this.setupConvertDebounce();
  }

  ngOnInit(): void {
    this.currencyService.getAvailableCurrencies()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('converter.error.loadCurrencies'));
          return of([]);
        })
      )
      .subscribe({
        next: (currencies) => {
          this.currencies.set(currencies);
        }
      });
    this.loadFavorites();
    this.convert();
  }

  convert(): void {
    if (this.amount() <= 0) {
      this.result.set(null);
      this.exchangeRate.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const fromCode = this.sanitizeCurrencyCode(this.fromCurrency());
    const toCode = this.sanitizeCurrencyCode(this.toCurrency());

    const historicalDateValue = this.historicalDate();
    const sanitizedDate = historicalDateValue ? this.sanitizeDate(historicalDateValue) : null;
    
    const convertObservable = sanitizedDate && this.showHistorical()
      ? this.apiService.getHistoricalRate(sanitizedDate, fromCode, [toCode])
      : this.apiService.getLatestRates(fromCode, [toCode]);

    convertObservable
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('converter.error.conversionFailed'));
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe({
        next: (data) => {
          if (data) {
            const rate = data.rates[toCode];
            if (rate && isFinite(rate) && rate > 0) {
              const amount = this.amount();
              const converted = amount * rate;
              
              this.result.set(converted);
              this.exchangeRate.set(rate);
              this.loading.set(false);

              this.addToHistory({
                from: fromCode,
                to: toCode,
                amount: amount,
                result: converted,
                rate: rate,
                date: new Date(),
                historicalDate: this.historicalDate() || undefined
              });
            } else {
              this.error.set(this.translation.translate('converter.error.invalidRate'));
              this.loading.set(false);
            }
          }
        }
      });
  }

  convertMultiple(): void {
    if (this.amount() <= 0 || this.multipleTargets().length === 0) {
      this.multipleResults.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const fromCode = this.sanitizeCurrencyCode(this.fromCurrency());
    const targets = this.multipleTargets().map(code => this.sanitizeCurrencyCode(code)).filter(c => c.length === 3);

    this.apiService.getLatestRates(fromCode, targets)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('converter.error.multipleConversionFailed'));
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe({
        next: (data) => {
          if (data) {
            const results: ConversionResult[] = this.multipleTargets()
              .map(code => {
                const sanitizedCode = this.sanitizeCurrencyCode(code);
                const rate = data.rates[sanitizedCode];
                if (rate && isFinite(rate) && rate > 0) {
                  return {
                    currency: sanitizedCode,
                    amount: this.amount() * rate,
                    rate: rate
                  };
                }
                return null;
              })
              .filter((r): r is ConversionResult => r !== null);
            this.multipleResults.set(results);
            this.loading.set(false);
          }
        }
      });
  }

  swapCurrencies(): void {
    const temp = this.fromCurrency();
    this.fromCurrency.set(this.toCurrency());
    this.toCurrency.set(temp);
    this.convert();
  }

  setAmountPreset(value: number): void {
    if (value > 0 && isFinite(value)) {
      this.amount.set(value);
      this.convert();
    }
  }

  updateAmount(value: number): void {
    const sanitized = isFinite(value) && value >= 0 ? value : 0;
    this.amount.set(sanitized);
    this.convertSubject.next();
  }

  updateFromCurrency(code: string): void {
    const sanitized = this.sanitizeCurrencyCode(code);
    if (sanitized) {
      this.fromCurrency.set(sanitized);
      this.convertSubject.next();
    }
  }

  updateToCurrency(code: string): void {
    const sanitized = this.sanitizeCurrencyCode(code);
    if (sanitized) {
      this.toCurrency.set(sanitized);
      this.convertSubject.next();
    }
  }

  updateHistoricalDate(date: string | null): void {
    if (date) {
      const sanitized = this.sanitizeDate(date);
      if (sanitized) {
        this.historicalDate.set(sanitized);
        this.convert();
      }
    } else {
      this.historicalDate.set(null);
      this.convert();
    }
  }

  toggleHistorical(): void {
    this.showHistorical.set(!this.showHistorical());
    if (!this.showHistorical()) {
      this.historicalDate.set(null);
    } else {
      this.historicalDate.set(format(new Date(), 'yyyy-MM-dd'));
    }
    this.convert();
  }

  toggleMultiple(): void {
    this.showMultiple.set(!this.showMultiple());
    if (!this.showMultiple()) {
      this.multipleTargets.set([]);
      this.multipleResults.set([]);
    }
  }

  toggleFavorite(currency: string): void {
    const sanitized = this.sanitizeCurrencyCode(currency);
    if (!sanitized) return;

    const favorites = this.favoriteCurrencies();
    if (favorites.includes(sanitized)) {
      this.favoriteCurrencies.set(favorites.filter(c => c !== sanitized));
    } else {
      if (favorites.length < 10) {
        this.favoriteCurrencies.set([...favorites, sanitized]);
      }
    }
    this.saveFavorites();
  }

  isFavorite(currency: string): boolean {
    return this.favoriteCurrencies().includes(this.sanitizeCurrencyCode(currency));
  }

  selectFavorite(currency: string, type: 'from' | 'to'): void {
    const sanitized = this.sanitizeCurrencyCode(currency);
    if (!sanitized) return;

    if (type === 'from') {
      this.fromCurrency.set(sanitized);
    } else {
      this.toCurrency.set(sanitized);
    }
    this.convert();
  }

  addTargetCurrency(currency: string): void {
    const sanitized = this.sanitizeCurrencyCode(currency);
    if (!sanitized || this.multipleTargets().includes(sanitized) || !this.canAddTarget()) {
      return;
    }
    this.multipleTargets.set([...this.multipleTargets(), sanitized]);
    this.convertMultiple();
  }

  removeTargetCurrency(currency: string): void {
    const sanitized = this.sanitizeCurrencyCode(currency);
    this.multipleTargets.set(this.multipleTargets().filter(c => c !== sanitized));
    this.convertMultiple();
  }

  copyResult(): void {
    const result = this.result();
    if (result !== null && isFinite(result)) {
      const fromCode = this.sanitizeCurrencyCode(this.fromCurrency());
      const toCode = this.sanitizeCurrencyCode(this.toCurrency());
      const text = `${this.amount()} ${fromCode} = ${result.toFixed(2)} ${toCode}`;
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
          this.error.set(this.translation.translate('converter.error.copyFailed'));
        });
      }
    }
  }

  clearHistory(): void {
    this.conversionHistory.set([]);
    try {
      localStorage.removeItem('aurafx-conversion-history');
    } catch {
      this.error.set(this.translation.translate('converter.error.clearHistoryFailed'));
    }
  }

  getMaxHistoricalDate(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }

  getMinHistoricalDate(): string {
    return '1999-01-01';
  }

  trackByCurrencyCode(_index: number, currency: Currency): string {
    return currency.code;
  }

  trackByString(_index: number, value: string): string {
    return value;
  }

  trackByNumber(_index: number, value: number): number {
    return value;
  }

  trackByHistoryDate(_index: number, item: ConversionHistory): string {
    return `${item.from}-${item.to}-${item.date.getTime()}`;
  }

  trackByResultCurrency(_index: number, result: ConversionResult): string {
    return result.currency;
  }

  private setupConvertDebounce(): void {
    this.convertSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.convert();
      });
  }

  private addToHistory(conversion: ConversionHistory): void {
    const history = [conversion, ...this.conversionHistory()].slice(0, 20);
    this.conversionHistory.set(history);
    try {
      localStorage.setItem('aurafx-conversion-history', JSON.stringify(history));
    } catch {
      this.error.set(this.translation.translate('converter.error.saveHistoryFailed'));
    }
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('aurafx-conversion-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const history = parsed.map((h: any) => ({
            ...h,
            date: new Date(h.date)
          })).filter((h: ConversionHistory) => !isNaN(h.date.getTime()));
          this.conversionHistory.set(history);
        }
      }
    } catch {
      this.conversionHistory.set([]);
    }
  }

  private loadFavorites(): void {
    try {
      const saved = localStorage.getItem('aurafx-favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const favorites = parsed.filter((c: any) => typeof c === 'string' && c.length === 3 && /^[A-Z]{3}$/.test(c));
          if (favorites.length > 0) {
            this.favoriteCurrencies.set(favorites);
          }
        }
      }
    } catch {
      this.favoriteCurrencies.set(['USD', 'GBP', 'JPY', 'CHF', 'AUD']);
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem('aurafx-favorites', JSON.stringify(this.favoriteCurrencies()));
    } catch {
      this.error.set(this.translation.translate('converter.error.saveFavoritesFailed'));
    }
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return '';
    const sanitized = code.trim().toUpperCase().slice(0, 3);
    return /^[A-Z]{3}$/.test(sanitized) ? sanitized : '';
  }

  private sanitizeDate(date: string): string | null {
    if (!date || typeof date !== 'string') return null;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return null;
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return null;
    const maxDate = new Date();
    const minDate = new Date('1999-01-01');
    if (parsed > maxDate || parsed < minDate) return null;
    return date;
  }
}
