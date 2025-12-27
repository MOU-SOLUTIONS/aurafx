// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, signal, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FrankfurterApiService } from '../../services/frankfurter-api.service';
import { CurrencyData } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';
import { format, subDays, subMonths } from 'date-fns';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-currency-analytics-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './currency-analytics-card.component.html',
  styleUrl: './currency-analytics-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrencyAnalyticsCardComponent implements OnInit, OnChanges {
  private readonly apiService = inject(FrankfurterApiService);
  readonly translation = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) currency!: CurrencyData;
  @Input() baseCurrency: string = 'EUR';

  readonly weekHigh = signal<number | null>(null);
  readonly weekLow = signal<number | null>(null);
  readonly monthHigh = signal<number | null>(null);
  readonly monthLow = signal<number | null>(null);
  readonly volatility = signal<number | null>(null);
  readonly trend = signal<'up' | 'down' | 'neutral'>('neutral');
  readonly avg7Days = signal<number | null>(null);
  readonly avg30Days = signal<number | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly isExpanded = signal<boolean>(false);

  readonly currentVsWeekHigh = computed(() => {
    const high = this.weekHigh();
    const rate = this.currency?.rate;
    if (!high || !rate || !isFinite(high) || !isFinite(rate) || high === 0) return null;
    return ((rate - high) / high) * 100;
  });

  readonly currentVsWeekLow = computed(() => {
    const low = this.weekLow();
    const rate = this.currency?.rate;
    if (!low || !rate || !isFinite(low) || !isFinite(rate) || low === 0) return null;
    return ((rate - low) / low) * 100;
  });

  readonly volatilityLevel = computed(() => {
    const vol = this.volatility();
    if (!vol || !isFinite(vol)) return 'low';
    if (vol < 0.5) return 'low';
    if (vol < 2) return 'medium';
    return 'high';
  });

  readonly rateVsAvg7Days = computed(() => {
    const avg = this.avg7Days();
    const rate = this.currency?.rate;
    if (!avg || !rate || !isFinite(avg) || !isFinite(rate) || avg === 0) return null;
    return ((rate - avg) / avg) * 100;
  });

  readonly rateVsAvg30Days = computed(() => {
    const avg = this.avg30Days();
    const rate = this.currency?.rate;
    if (!avg || !rate || !isFinite(avg) || !isFinite(rate) || avg === 0) return null;
    return ((rate - avg) / avg) * 100;
  });

  readonly getVolatilityWidth = computed(() => {
    const vol = this.volatility();
    if (!vol || !isFinite(vol)) return 0;
    return Math.min(vol * 10, 100);
  });

  readonly getRangeWidth = computed(() => {
    const low = this.weekLow();
    const high = this.weekHigh();
    if (!low || !high || !isFinite(low) || !isFinite(high) || high === 0) return 0;
    const range = high - low;
    return (range / high) * 100;
  });

  readonly getCurrentPosition = computed(() => {
    const low = this.weekLow();
    const high = this.weekHigh();
    const rate = this.currency?.rate;
    if (!low || !high || !rate || !isFinite(low) || !isFinite(high) || !isFinite(rate) || low === high) return 50;
    const range = high - low;
    return ((rate - low) / range) * 100;
  });

  ngOnInit(): void {
    if (this.currency?.code) {
      this.loadAnalytics();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const currencyChange = changes['currency'];
    const baseCurrencyChange = changes['baseCurrency'];
    
    if ((currencyChange && !currencyChange.firstChange) || (baseCurrencyChange && !baseCurrencyChange.firstChange)) {
      if (this.currency?.code) {
        this.loadAnalytics();
      }
    }
  }

  loadAnalytics(): void {
    if (!this.currency?.code) {
      this.error.set(this.translation.translate('analytics.error.invalidCurrency'));
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const endDate = format(new Date(), 'yyyy-MM-dd');
    const weekStart = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const monthStart = format(subMonths(new Date(), 1), 'yyyy-MM-dd');

    const baseCode = this.sanitizeCurrencyCode(this.baseCurrency);
    const currencyCode = this.sanitizeCurrencyCode(this.currency.code);

    const weekRequest = this.apiService.getTimeSeries(weekStart, endDate, baseCode, [currencyCode])
      .pipe(
        map(data => this.extractRates(data, currencyCode)),
        catchError(() => of([]))
      );

    const monthRequest = this.apiService.getTimeSeries(monthStart, endDate, baseCode, [currencyCode])
      .pipe(
        map(data => this.extractRates(data, currencyCode)),
        catchError(() => of([]))
      );

    forkJoin({ week: weekRequest, month: monthRequest })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ week, month }) => {
          this.processWeekData(week);
          this.processMonthData(month);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translation.translate('analytics.error.loadFailed'));
          this.loading.set(false);
        }
      });
  }

  toggleExpand(): void {
    this.isExpanded.update(value => !value);
  }

  getRate(): number {
    const rate = this.currency?.rate ?? 0;
    return isFinite(rate) && rate > 0 ? rate : 0;
  }

  getChange24h(): number {
    const change = this.currency?.change24h ?? 0;
    return isFinite(change) ? change : 0;
  }

  getChangePercent(): number {
    const change = this.currency?.changePercent24h ?? 0;
    return isFinite(change) ? change : 0;
  }

  private processWeekData(rates: number[]): void {
    if (rates.length === 0) return;

    const validRates = rates.filter(r => isFinite(r) && r > 0);
    if (validRates.length === 0) return;

    this.weekHigh.set(Math.max(...validRates));
    this.weekLow.set(Math.min(...validRates));
    
    const sum = validRates.reduce((a, b) => a + b, 0);
    this.avg7Days.set(sum / validRates.length);
    
    this.calculateVolatility(validRates);
    this.determineTrend(validRates);
  }

  private processMonthData(rates: number[]): void {
    if (rates.length === 0) return;

    const validRates = rates.filter(r => isFinite(r) && r > 0);
    if (validRates.length === 0) return;

    this.monthHigh.set(Math.max(...validRates));
    this.monthLow.set(Math.min(...validRates));
    
    const sum = validRates.reduce((a, b) => a + b, 0);
    this.avg30Days.set(sum / validRates.length);
  }

  private extractRates(data: unknown, currencyCode: string): number[] {
    const rates: number[] = [];
    if (!data || typeof data !== 'object' || !('rates' in data)) return rates;
    
    const ratesData = (data as { rates?: Record<string, Record<string, number>> }).rates;
    if (!ratesData || typeof ratesData !== 'object') return rates;
    
    Object.values(ratesData).forEach((dayRates: unknown) => {
      if (dayRates && typeof dayRates === 'object' && currencyCode in dayRates) {
        const rate = (dayRates as Record<string, unknown>)[currencyCode];
        if (typeof rate === 'number' && isFinite(rate) && rate > 0) {
          rates.push(rate);
        }
      }
    });
    return rates;
  }

  private calculateVolatility(rates: number[]): void {
    if (rates.length < 2) {
      this.volatility.set(null);
      return;
    }

    const validRates = rates.filter(r => isFinite(r) && r > 0);
    if (validRates.length < 2) {
      this.volatility.set(null);
      return;
    }

    const sum = validRates.reduce((a, b) => a + b, 0);
    const mean = sum / validRates.length;
    
    if (!isFinite(mean) || mean === 0) {
      this.volatility.set(null);
      return;
    }

    const variance = validRates.reduce((sum, rate) => {
      const diff = rate - mean;
      return sum + (diff * diff);
    }, 0) / validRates.length;
    
    const stdDev = Math.sqrt(variance);
    if (!isFinite(stdDev)) {
      this.volatility.set(null);
      return;
    }

    const volatilityPercent = (stdDev / mean) * 100;
    this.volatility.set(isFinite(volatilityPercent) ? volatilityPercent : null);
  }

  private determineTrend(rates: number[]): void {
    if (rates.length < 2) {
      this.trend.set('neutral');
      return;
    }

    const validRates = rates.filter(r => isFinite(r) && r > 0);
    if (validRates.length < 2) {
      this.trend.set('neutral');
      return;
    }

    const midPoint = Math.floor(validRates.length / 2);
    const firstHalf = validRates.slice(0, midPoint);
    const secondHalf = validRates.slice(midPoint);

    const firstSum = firstHalf.reduce((a, b) => a + b, 0);
    const secondSum = secondHalf.reduce((a, b) => a + b, 0);
    
    const firstAvg = firstSum / firstHalf.length;
    const secondAvg = secondSum / secondHalf.length;

    if (!isFinite(firstAvg) || !isFinite(secondAvg) || firstAvg === 0) {
      this.trend.set('neutral');
      return;
    }

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (!isFinite(change)) {
      this.trend.set('neutral');
      return;
    }

    if (change > 0.1) this.trend.set('up');
    else if (change < -0.1) this.trend.set('down');
    else this.trend.set('neutral');
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return 'EUR';
    const sanitized = code.trim().toUpperCase().slice(0, 3);
    return /^[A-Z]{3}$/.test(sanitized) ? sanitized : 'EUR';
  }
}
