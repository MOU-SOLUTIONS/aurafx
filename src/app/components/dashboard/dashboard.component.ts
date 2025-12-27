// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyAnalyticsCardComponent } from '../currency-analytics-card/currency-analytics-card.component';
import { MarketOverviewComponent } from '../market-overview/market-overview.component';
import { CurrencyService } from '../../services/currency.service';
import { CurrencyData } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';
import { Currency } from '../../models/currency.model';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    CurrencyAnalyticsCardComponent,
    MarketOverviewComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly currencyService = inject(CurrencyService);
  readonly translation = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);

  currencies = signal<CurrencyData[]>([]);
  baseCurrency = signal('EUR');
  availableCurrencies = signal<Currency[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  lastUpdate = signal<Date | null>(null);

  readonly marketStats = computed(() => this.getMarketStats());
  readonly marketStatsArray = computed(() => this.getMarketStatsArray());

  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000;

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
        this.baseCurrency.set(sanitized);
      });

    this.currencyService.getAvailableCurrencies()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('dashboard.error.loadCurrencies'));
          return of([]);
        })
      )
      .subscribe(currencies => {
        this.availableCurrencies.set(currencies);
      });

    this.loadData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.currencyService.getCurrencyData()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('dashboard.error.loadFailed'));
          this.loading.set(false);
          return of([]);
        })
      )
      .subscribe({
        next: (data) => {
          this.currencies.set(data);
          this.lastUpdate.set(new Date());
          this.loading.set(false);
        }
      });
  }

  onBaseCurrencyChange(currency: string): void {
    const sanitized = this.sanitizeCurrencyCode(currency);
    this.currencyService.setBaseCurrency(sanitized);
    this.baseCurrency.set(sanitized);
  }

  onRefresh(): void {
    this.loadData();
  }

  onRetry(): void {
    this.loadData();
  }

  trackByCurrencyCode(_index: number, currency: CurrencyData | Currency): string {
    return currency?.code || `currency-${_index}`;
  }

  trackByStatIndex(_index: number): number {
    return _index;
  }

  private getMarketStats(): {
    totalCurrencies: number;
    gainers: number;
    losers: number;
    neutral: number;
    avgChange: number;
  } {
    const data = this.currencies();
    if (!data || data.length === 0) {
      return {
        totalCurrencies: 0,
        gainers: 0,
        losers: 0,
        neutral: 0,
        avgChange: 0
      };
    }

    let gainers = 0;
    let losers = 0;
    const changes: number[] = [];

    for (const c of data) {
      const change = c.changePercent24h ?? 0;
      if (isFinite(change)) {
        changes.push(Math.abs(change));
        if (change > 0) {
          gainers++;
        } else if (change < 0) {
          losers++;
        }
      }
    }
    
    const neutral = data.length - gainers - losers;
    const avgChange = changes.length > 0
      ? changes.reduce((sum, c) => sum + c, 0) / changes.length
      : 0;

    return {
      totalCurrencies: data.length,
      gainers,
      losers,
      neutral,
      avgChange: isFinite(avgChange) ? avgChange : 0
    };
  }

  private getMarketStatsArray(): Array<{
    label: string;
    value: string | number;
    icon: string;
    color?: string;
  }> {
    const stats = this.marketStats();
    return [
      { label: 'insights.totalCurrencies', value: stats.totalCurrencies, icon: '💱' },
      { label: 'insights.gainers', value: stats.gainers, icon: '📈', color: 'success' },
      { label: 'insights.losers', value: stats.losers, icon: '📉', color: 'error' },
      { label: 'insights.avgVolatility', value: stats.avgChange.toFixed(2) + '%', icon: '📊' }
    ];
  }

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.loadData();
    }, this.REFRESH_INTERVAL_MS);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return 'EUR';
    const sanitized = code.trim().toUpperCase().slice(0, 3);
    return /^[A-Z]{3}$/.test(sanitized) ? sanitized : 'EUR';
  }
}
