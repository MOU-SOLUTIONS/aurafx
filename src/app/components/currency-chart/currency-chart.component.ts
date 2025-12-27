// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed, effect, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartData, registerables, TooltipItem } from 'chart.js';
import { FrankfurterApiService } from '../../services/frankfurter-api.service';
import { CurrencyService } from '../../services/currency.service';
import { Currency, HistoricalRate } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';
import { subDays, subMonths, subYears, format, parseISO } from 'date-fns';
import { debounceTime, switchMap, catchError } from 'rxjs/operators';
import { Subject, of } from 'rxjs';

Chart.register(...registerables);

type ChartType = 'line' | 'bar' | 'area' | 'candlestick';
type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

interface ChartSettings {
  showGrid: boolean;
  showLegend: boolean;
  showCrosshair: boolean;
  smoothCurves: boolean;
  showPoints: boolean;
  chartTheme: 'default' | 'gradient' | 'minimal';
}

interface PerformanceMetrics {
  high: number;
  low: number;
  average: number;
  change: number;
  changePercent: number;
  volatility: number;
  trend: 'up' | 'down' | 'neutral';
}

interface DateRateData {
  date: string;
  rate: number;
  change: number;
  changePercent: number;
}

@Component({
  selector: 'app-currency-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './currency-chart.component.html',
  styleUrl: './currency-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrencyChartComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiService = inject(FrankfurterApiService);
  private readonly currencyService = inject(CurrencyService);
  readonly translation = inject(TranslationService);
  private readonly loadDataSubject = new Subject<void>();

  selectedCurrency = signal('USD');
  overlayCurrencies = signal<string[]>([]);
  timeRange = signal<TimeRange>('1M');
  chartType = signal<ChartType>('line');
  currencies: Currency[] = [];
  loading = signal(false);
  error = signal<string | null>(null);
  chart: Chart | null = null;

  showSettings = signal(false);
  showIndicators = signal(false);
  showMetrics = signal(true);
  showDataTable = signal(false);
  showExportMenu = signal(false);
  customDateRange = signal<{ start: string | null; end: string | null }>({ start: null, end: null });
  useCustomRange = signal(false);

  chartSettings = signal<ChartSettings>({
    showGrid: true,
    showLegend: true,
    showCrosshair: true,
    smoothCurves: true,
    showPoints: false,
    chartTheme: 'default'
  });

  showMA = signal(false);
  maPeriod = signal(20);
  showEMA = signal(false);
  emaPeriod = signal(12);

  metrics = signal<PerformanceMetrics | null>(null);
  chartData = signal<HistoricalRate | null>(null);
  private renderRetryCount = 0;
  private readonly MAX_RENDER_RETRIES = 10;

  readonly colorPalette = [
    'rgb(99, 102, 241)',
    'rgb(168, 85, 247)',
    'rgb(236, 72, 153)',
    'rgb(239, 68, 68)',
    'rgb(245, 158, 11)',
    'rgb(16, 185, 129)',
    'rgb(59, 130, 246)',
    'rgb(139, 92, 246)'
  ] as const;

  readonly sortedDates = computed(() => {
    const data = this.chartData();
    if (!data) return [];
    return Object.keys(data.rates).sort().reverse();
  });

  readonly tableData = computed(() => {
    const data = this.chartData();
    const dates = this.sortedDates();
    if (!data || dates.length === 0) return [];
    
    const result: DateRateData[] = [];
    const sortedDatesAsc = [...dates].reverse();
    const currency = this.selectedCurrency();
    
    for (let i = 0; i < sortedDatesAsc.length; i++) {
      const date = sortedDatesAsc[i];
      const rate = data.rates[date]?.[currency] || 0;
      let change = 0;
      let changePercent = 0;
      
      if (i > 0) {
        const prevDate = sortedDatesAsc[i - 1];
        const prevRate = data.rates[prevDate]?.[currency] || 0;
        if (prevRate > 0 && isFinite(prevRate) && isFinite(rate)) {
          change = rate - prevRate;
          changePercent = (change / prevRate) * 100;
        }
      }
      
      if (isFinite(rate) && rate > 0) {
        result.push({ date, rate, change, changePercent });
      }
    }
    
    return result.reverse();
  });

  readonly chartTypeOptions = ['line', 'bar', 'area'] as const;
  readonly timeRangeOptions = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'] as const;

  constructor() {
    this.loadDataSubject.pipe(
      debounceTime(300),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.loadChartData();
    });

    effect(() => {
      const currency = this.selectedCurrency();
      const range = this.timeRange();
      if (currency && range) {
        this.loadDataSubject.next();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.currencyService.getAvailableCurrencies()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.error.set(this.translation.translate('cards.error'));
          return of([]);
        })
      )
      .subscribe({
        next: (currencies) => {
          this.currencies = currencies;
        }
      });
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.loadDataSubject.complete();
  }

  loadChartData(): void {
    const currency = this.selectedCurrency();
    if (!currency) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { startDate, endDate } = this.getDateRange();
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    
    const currenciesToLoad = [currency, ...this.overlayCurrencies()].filter(c => {
      const sanitized = this.sanitizeCurrencyCode(c);
      return sanitized.length === 3;
    });

    this.currencyService.getBaseCurrency()
      .pipe(
        switchMap(baseCurrency => {
          const sanitizedBase = this.sanitizeCurrencyCode(baseCurrency);
          const sanitizedCurrencies = currenciesToLoad.map(c => this.sanitizeCurrencyCode(c));
          return this.apiService.getTimeSeries(startDateStr, endDateStr, sanitizedBase, sanitizedCurrencies);
        }),
        catchError(() => {
          this.error.set(this.translation.translate('cards.error'));
          this.loading.set(false);
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (data) => {
          if (data) {
            this.chartData.set(data);
            this.calculateMetrics(data);
            this.loading.set(false);
            setTimeout(() => {
              this.renderChart(data);
            }, 0);
          }
        }
      });
  }

  private calculateMetrics(data: HistoricalRate): void {
    const dates = Object.keys(data.rates).sort();
    const currency = this.selectedCurrency();
    const rates = dates
      .map(date => {
        const rate = data.rates[date]?.[currency];
        return typeof rate === 'number' && isFinite(rate) && rate > 0 ? rate : null;
      })
      .filter((r): r is number => r !== null);
    
    if (rates.length === 0) {
      this.metrics.set(null);
      return;
    }
    
    const high = Math.max(...rates);
    const low = Math.min(...rates);
    const sum = rates.reduce((a, b) => a + b, 0);
    const average = sum / rates.length;
    const firstRate = rates[0];
    const lastRate = rates[rates.length - 1];
    const change = lastRate - firstRate;
    const changePercent = firstRate !== 0 ? (change / firstRate) * 100 : 0;
    
    const variance = rates.reduce((sum, rate) => {
      const diff = rate - average;
      return sum + (diff * diff);
    }, 0) / rates.length;
    const volatility = average !== 0 ? Math.sqrt(variance) / average * 100 : 0;
    
    const midPoint = Math.floor(rates.length / 2);
    const firstHalf = rates.slice(0, midPoint);
    const secondHalf = rates.slice(midPoint);
    const firstSum = firstHalf.reduce((a, b) => a + b, 0);
    const secondSum = secondHalf.reduce((a, b) => a + b, 0);
    const firstAvg = firstSum / firstHalf.length;
    const secondAvg = secondSum / secondHalf.length;
    const trend = secondAvg > firstAvg * 1.01 ? 'up' : secondAvg < firstAvg * 0.99 ? 'down' : 'neutral';
    
    this.metrics.set({
      high,
      low,
      average,
      change,
      changePercent,
      volatility,
      trend
    });
  }

  private renderChart(data: HistoricalRate): void {
    const canvas = document.getElementById('currencyChart') as HTMLCanvasElement;
    if (!canvas) {
      if (this.renderRetryCount < this.MAX_RENDER_RETRIES) {
        this.renderRetryCount++;
        setTimeout(() => this.renderChart(data), 50);
      }
      return;
    }
    this.renderRetryCount = 0;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: false });
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const dates = Object.keys(data.rates).sort();
    const settings = this.chartSettings();
    const currency = this.selectedCurrency();
    
    const mainRates = dates.map(date => {
      const rate = data.rates[date]?.[currency];
      return typeof rate === 'number' && isFinite(rate) ? rate : null;
    });
    
    const datasets: any[] = [{
      label: `${data.base}/${currency}`,
      data: mainRates,
      borderColor: this.colorPalette[0],
      backgroundColor: this.chartType() === 'area' || this.chartType() === 'line' 
        ? this.getGradient(ctx, this.colorPalette[0])
        : this.colorPalette[0] + '40',
      borderWidth: 2,
      fill: this.chartType() === 'area',
      tension: settings.smoothCurves ? 0.4 : 0,
      pointRadius: settings.showPoints ? 3 : 0,
      pointHoverRadius: 6,
      pointBackgroundColor: this.colorPalette[0],
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    }];

    this.overlayCurrencies().forEach((code, index) => {
      const sanitizedCode = this.sanitizeCurrencyCode(code);
      if (!sanitizedCode || sanitizedCode === currency) return;
      
      const overlayRates = dates.map(date => {
        const rate = data.rates[date]?.[sanitizedCode];
        return typeof rate === 'number' && isFinite(rate) ? rate : null;
      });
      
      datasets.push({
        label: `${data.base}/${sanitizedCode}`,
        data: overlayRates,
        borderColor: this.colorPalette[(index + 1) % this.colorPalette.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: settings.smoothCurves ? 0.4 : 0,
        pointRadius: 0,
        pointHoverRadius: 6
      });
    });

    if (this.showMA()) {
      const maData = this.calculateMA(mainRates, this.maPeriod());
      datasets.push({
        label: `MA(${this.maPeriod()})`,
        data: maData,
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [10, 5],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0
      });
    }

    if (this.showEMA()) {
      const emaData = this.calculateEMA(mainRates, this.emaPeriod());
      datasets.push({
        label: `EMA(${this.emaPeriod()})`,
        data: emaData,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [5, 5],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0
      });
    }

    const chartData: ChartData = {
      labels: dates.map(date => format(parseISO(date), 'MMM dd')),
      datasets: datasets
    };

    const chartType = this.chartType() === 'area' || this.chartType() === 'candlestick' ? 'line' : this.chartType();
    
    const config: ChartConfiguration = {
      type: chartType as 'line' | 'bar',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
          }
        },
        animation: {
          duration: 0
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: settings.showLegend,
            position: 'top',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              padding: 15,
              font: {
                size: 12,
                weight: 600
              },
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 700
            },
            bodyFont: {
              size: 13
            },
            displayColors: true,
            callbacks: {
              label: (context: TooltipItem<any>) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null && isFinite(context.parsed.y)) {
                  label += context.parsed.y.toFixed(4);
                }
                return label;
              }
            }
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              color: settings.showGrid ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              font: {
                size: 11
              },
              padding: 12,
              callback: (value) => {
                const num = Number(value);
                return isFinite(num) ? num.toFixed(4) : '';
              }
            }
          },
          x: {
            grid: {
              display: settings.showGrid,
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.6)',
              font: {
                size: 11
              },
              padding: 12
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  private calculateMA(data: (number | null)[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const validPeriod = Math.max(2, Math.min(100, period));
    
    for (let i = 0; i < data.length; i++) {
      if (i < validPeriod - 1) {
        result.push(null);
      } else {
        const slice = data.slice(i - validPeriod + 1, i + 1).filter((v): v is number => v !== null && isFinite(v));
        if (slice.length > 0) {
          const sum = slice.reduce((a, b) => a + b, 0);
          result.push(sum / slice.length);
        } else {
          result.push(null);
        }
      }
    }
    return result;
  }

  private calculateEMA(data: (number | null)[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    const validPeriod = Math.max(2, Math.min(100, period));
    const multiplier = 2 / (validPeriod + 1);
    let ema: number | null = null;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] === null || !isFinite(data[i]!)) {
        result.push(null);
        continue;
      }
      
      if (ema === null) {
        const firstValues = data.slice(0, Math.min(validPeriod, i + 1)).filter((v): v is number => v !== null && isFinite(v));
        if (firstValues.length > 0) {
          const sum = firstValues.reduce((a, b) => a + b, 0);
          ema = sum / firstValues.length;
        }
      } else {
        ema = (data[i]! - ema) * multiplier + ema;
      }
      result.push(ema);
    }
    return result;
  }

  private getGradient(ctx: CanvasRenderingContext2D, color: string): CanvasGradient {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    const rgbaColor = color.replace('rgb', 'rgba').replace(')', ', 0.3)');
    gradient.addColorStop(0, rgbaColor);
    gradient.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ', 0)'));
    return gradient;
  }

  setTimeRange(range: string): void {
    const sanitized = this.sanitizeInput(range);
    if (this.timeRangeOptions.includes(sanitized as TimeRange)) {
      this.timeRange.set(sanitized as TimeRange);
      this.useCustomRange.set(false);
      this.loading.set(true);
      this.triggerDataLoad();
    }
  }

  setChartType(type: string): void {
    const sanitized = this.sanitizeInput(type);
    if (this.chartTypeOptions.includes(sanitized as 'line' | 'bar' | 'area')) {
      this.chartType.set(sanitized as ChartType);
      const data = this.chartData();
      if (data) {
        setTimeout(() => {
          this.renderChart(data);
        }, 0);
      } else {
        this.triggerDataLoad();
      }
    }
  }

  triggerDataLoad(): void {
    this.loadDataSubject.next();
  }

  toggleOverlayCurrency(code: string): void {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    if (!sanitizedCode || sanitizedCode === this.selectedCurrency()) return;

    const overlays = this.overlayCurrencies();
    if (overlays.includes(sanitizedCode)) {
      this.overlayCurrencies.set(overlays.filter(c => c !== sanitizedCode));
    } else {
      if (overlays.length < 5) {
        this.overlayCurrencies.set([...overlays, sanitizedCode]);
      }
    }
    this.triggerDataLoad();
  }

  exportChart(exportFormat: 'png' | 'pdf'): void {
    if (!this.chart) return;
    
    if (exportFormat === 'png') {
      try {
        const url = this.chart.toBase64Image();
        const link = document.createElement('a');
        link.href = url;
        const sanitizedCurrency = this.sanitizeCurrencyCode(this.selectedCurrency());
        const sanitizedDate = format(new Date(), 'yyyy-MM-dd').replace(/[^0-9-]/g, '');
        link.download = `chart-${sanitizedCurrency}-${sanitizedDate}.png`;
        link.click();
        link.remove();
      } catch (error) {
        this.error.set(this.translation.translate('charts.exportError'));
      }
    }
  }

  resetZoom(): void {
    this.chartType.set('line');
    this.timeRange.set('1M');
    this.useCustomRange.set(false);
    this.customDateRange.set({ start: null, end: null });
    
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    
    this.triggerDataLoad();
  }

  private getDateRange(): { startDate: Date; endDate: Date } {
    if (this.useCustomRange() && this.customDateRange().start && this.customDateRange().end) {
      const start = parseISO(this.customDateRange().start!);
      const end = parseISO(this.customDateRange().end!);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const maxDate = new Date();
        const minDate = parseISO('1999-01-01');
        const clampedStart = start < minDate ? minDate : start > maxDate ? maxDate : start;
        const clampedEnd = end < minDate ? minDate : end > maxDate ? maxDate : end;
        return { startDate: clampedStart, endDate: clampedEnd };
      }
    }

    const endDate = new Date();
    let startDate: Date;
    
    switch (this.timeRange()) {
      case '1D':
        startDate = subDays(endDate, 1);
        break;
      case '1W':
        startDate = subDays(endDate, 7);
        break;
      case '1M':
        startDate = subMonths(endDate, 1);
        break;
      case '3M':
        startDate = subMonths(endDate, 3);
        break;
      case '6M':
        startDate = subMonths(endDate, 6);
        break;
      case '1Y':
        startDate = subYears(endDate, 1);
        break;
      case 'ALL':
        startDate = parseISO('1999-01-01');
        break;
      default:
        startDate = subMonths(endDate, 1);
    }
    
    return { startDate, endDate };
  }

  getMaxDate(): string {
    return format(new Date(), 'yyyy-MM-dd');
  }

  getMinDate(): string {
    return '1999-01-01';
  }

  formatDate(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }

  formatDateForDisplay(dateStr: string): string {
    try {
      const parsed = parseISO(dateStr);
      if (isNaN(parsed.getTime())) return dateStr;
      return format(parsed, 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  }

  trackByCurrencyCode(_index: number, currency: Currency): string {
    return currency.code;
  }

  trackByDate(_index: number, date: string): string {
    return date;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByTableData(_index: number, item: DateRateData): string {
    return item.date;
  }

  updateCustomDateRangeStart(value: string | null): void {
    const sanitized = value ? this.sanitizeDateInput(value) : null;
    const current = this.customDateRange();
    this.customDateRange.set({ start: sanitized, end: current.end });
    this.triggerDataLoad();
  }

  updateCustomDateRangeEnd(value: string | null): void {
    const sanitized = value ? this.sanitizeDateInput(value) : null;
    const current = this.customDateRange();
    this.customDateRange.set({ start: current.start, end: sanitized });
    this.triggerDataLoad();
  }

  updateChartSetting<K extends keyof ChartSettings>(key: K, value: ChartSettings[K]): void {
    const current = this.chartSettings();
    this.chartSettings.set({ ...current, [key]: value });
    const data = this.chartData();
    if (data) {
      this.renderChart(data);
    } else {
      this.triggerDataLoad();
    }
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return '';
    return code.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 3);
  }

  private sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[<>\"'&]/g, '').trim();
  }

  private sanitizeDateInput(dateStr: string): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const sanitized = dateStr.replace(/[^0-9-]/g, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) return null;
    try {
      const parsed = parseISO(sanitized);
      if (isNaN(parsed.getTime())) return null;
      return sanitized;
    } catch {
      return null;
    }
  }
}
