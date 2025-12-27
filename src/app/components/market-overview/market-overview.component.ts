// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { CurrencyService } from '../../services/currency.service';
import { FrankfurterApiService } from '../../services/frankfurter-api.service';
import { CurrencyData } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';
import { subDays, format } from 'date-fns';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface CurrencyStrength {
  code: string;
  name: string;
  strength: number;
  trend: 'strong' | 'moderate' | 'weak';
  change24h: number;
  change7d: number;
  change30d: number;
}

@Component({
  selector: 'app-market-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './market-overview.component.html',
  styleUrl: './market-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarketOverviewComponent implements OnInit {
  private readonly currencyService = inject(CurrencyService);
  private readonly apiService = inject(FrankfurterApiService);
  readonly translation = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  currencies = signal<CurrencyData[]>([]);
  baseCurrency = signal('EUR');
  loading = signal(true);
  error = signal<string | null>(null);
  historical7d = signal<Record<string, number>>({});
  historical30d = signal<Record<string, number>>({});

  private readonly STRENGTH_THRESHOLD_STRONG = 2;
  private readonly STRENGTH_THRESHOLD_WEAK = -2;
  private readonly MAX_STRENGTH = 10;
  private readonly MIN_STRENGTH = -10;

  readonly currencyStrengths = computed(() => this.calculateStrengths());
  
  readonly strongestCurrencies = computed(() => {
    const strengths = this.currencyStrengths();
    return strengths
      .filter(c => c.strength > this.STRENGTH_THRESHOLD_STRONG)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);
  });
  
  readonly weakestCurrencies = computed(() => {
    const strengths = this.currencyStrengths();
    return strengths
      .filter(c => c.strength < this.STRENGTH_THRESHOLD_WEAK)
      .sort((a, b) => a.strength - b.strength)
      .slice(0, 5);
  });

  ngOnInit(): void {
    this.currencyService.getBaseCurrency()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.baseCurrency.set('EUR');
          return of('EUR');
        })
      )
      .subscribe(base => {
        const sanitized = this.sanitizeCurrencyCode(base);
        if (sanitized) {
          this.baseCurrency.set(sanitized);
        }
      });

    this.loadMarketData();
  }

  loadMarketData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.currencyService.getCurrencyData()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('market.error.loadFailed'));
          this.loading.set(false);
          return of([]);
        })
      )
      .subscribe({
        next: (data) => {
          this.currencies.set(data);
          this.loadHistoricalData();
        }
      });
  }

  private loadHistoricalData(): void {
    const base = this.sanitizeCurrencyCode(this.baseCurrency());
    if (!base) {
      this.loading.set(false);
      return;
    }

    const symbols = this.currencies()
      .map(c => this.sanitizeCurrencyCode(c.code))
      .filter((code): code is string => Boolean(code));

    if (symbols.length === 0) {
      this.loading.set(false);
      return;
    }

    const date7d = this.sanitizeDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const date30d = this.sanitizeDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    
    if (!date7d || !date30d) {
      this.loading.set(false);
      return;
    }

    const request7d = this.apiService.getHistoricalRate(date7d, base, symbols)
      .pipe(
        map(data => this.extractRates(data, symbols)),
        catchError(() => of({}))
      );

    const request30d = this.apiService.getHistoricalRate(date30d, base, symbols)
      .pipe(
        map(data => this.extractRates(data, symbols)),
        catchError(() => of({}))
      );

    forkJoin({ data7d: request7d, data30d: request30d })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data7d, data30d }) => {
          this.historical7d.set(data7d);
          this.historical30d.set(data30d);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  private extractRates(data: unknown, symbols: string[]): Record<string, number> {
    const rates: Record<string, number> = {};
    if (!data || typeof data !== 'object' || !('rates' in data)) return rates;
    
    const ratesData = (data as { rates?: Record<string, number> }).rates;
    if (!ratesData || typeof ratesData !== 'object') return rates;
    
    symbols.forEach(code => {
      const rate = ratesData[code];
      if (rate && isFinite(rate) && rate > 0) {
        rates[code] = rate;
      }
    });
    return rates;
  }

  private calculateStrengths(): CurrencyStrength[] {
    const currencies = this.currencies();
    const historical7d = this.historical7d();
    const historical30d = this.historical30d();

    if (currencies.length === 0) return [];

    const results: CurrencyStrength[] = [];

    for (const currency of currencies) {
      const currentRate = currency.rate;
      if (!isFinite(currentRate) || currentRate <= 0) continue;

      const rate7d = historical7d[currency.code];
      const rate30d = historical30d[currency.code];

      const change7d = rate7d && rate7d > 0 && isFinite(rate7d)
        ? ((currentRate - rate7d) / rate7d) * 100
        : 0;
      const change30d = rate30d && rate30d > 0 && isFinite(rate30d)
        ? ((currentRate - rate30d) / rate30d) * 100
        : 0;
      const change24h = currency.changePercent24h && isFinite(currency.changePercent24h)
        ? currency.changePercent24h
        : 0;

      const strength = (change24h * 0.5) + (change7d * 0.3) + (change30d * 0.2);
      
      let trend: 'strong' | 'moderate' | 'weak';
      if (strength > this.STRENGTH_THRESHOLD_STRONG) {
        trend = 'strong';
      } else if (strength < this.STRENGTH_THRESHOLD_WEAK) {
        trend = 'weak';
      } else {
        trend = 'moderate';
      }

      if (isFinite(strength)) {
        results.push({
          code: currency.code,
          name: currency.name,
          strength: strength,
          trend,
          change24h: isFinite(change24h) ? change24h : 0,
          change7d: isFinite(change7d) ? change7d : 0,
          change30d: isFinite(change30d) ? change30d : 0
        });
      }
    }

    return results.sort((a, b) => b.strength - a.strength);
  }

  trackByCode(_index: number, item: CurrencyStrength): string {
    return item.code;
  }

  getStrengthColor(strength: number): string {
    if (strength > this.STRENGTH_THRESHOLD_STRONG) return 'strong';
    if (strength < this.STRENGTH_THRESHOLD_WEAK) return 'weak';
    return 'moderate';
  }

  getStrengthWidth(strength: number): number {
    if (!isFinite(strength)) return 50;
    const normalized = ((strength - this.MIN_STRENGTH) / (this.MAX_STRENGTH - this.MIN_STRENGTH)) * 100;
    return Math.max(0, Math.min(100, normalized));
  }

  getRank(index: number): number {
    return index + 1;
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return '';
    return code.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 3);
  }

  private sanitizeDate(date: string): string | null {
    if (!date || typeof date !== 'string') return null;
    const sanitized = date.replace(/[^0-9-]/g, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) return null;
    const parsed = new Date(sanitized);
    if (isNaN(parsed.getTime())) return null;
    const maxDate = new Date();
    const minDate = new Date('1999-01-01');
    if (parsed > maxDate || parsed < minDate) return null;
    return sanitized;
  }
}
