// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyService } from '../../services/currency.service';
import { CurrencyData } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface FilterOptions {
  minChange: number | null;
  maxChange: number | null;
  onlyGainers: boolean;
  onlyLosers: boolean;
  favoritesOnly: boolean;
  minRate: number | null;
  maxRate: number | null;
}

interface ColumnVisibility {
  code: boolean;
  name: boolean;
  rate: boolean;
}

@Component({
  selector: 'app-rates-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rates-table.component.html',
  styleUrl: './rates-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatesTableComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  currencies = signal<CurrencyData[]>([]);
  searchTerm = signal('');
  loading = signal(true);
  error = signal<string | null>(null);
  sortColumn = signal<'code' | 'rate' | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');
  viewMode = signal<'table' | 'grid' | 'cards'>('table');
  showFilters = signal(false);
  filters = signal<FilterOptions>({
    minChange: null,
    maxChange: null,
    onlyGainers: false,
    onlyLosers: false,
    favoritesOnly: false,
    minRate: null,
    maxRate: null
  });
  columnVisibility = signal<ColumnVisibility>({
    code: true,
    name: true,
    rate: true
  });
  selectedCurrencies = signal<string[]>([]);
  favoriteCurrencies = signal<string[]>([]);
  pageSize = signal(25);
  currentPage = signal(1);
  showComparison = signal(false);
  comparisonCurrencies = signal<string[]>([]);
  showExportMenu = signal(false);

  filteredCurrencies = computed(() => {
    let data = [...this.currencies()];
    const term = this.searchTerm().toLowerCase().trim();
    const filterOpts = this.filters();
    
    if (term) {
      const sanitizedTerm = this.sanitizeInput(term);
      data = data.filter(c => {
        const code = this.sanitizeCurrencyCode(c.code);
        const name = this.sanitizeInput(c.name.toLowerCase());
        return code.includes(sanitizedTerm) || name.includes(sanitizedTerm);
      });
    }
    
    if (filterOpts.minChange !== null && isFinite(filterOpts.minChange)) {
      data = data.filter(c => (c.changePercent24h ?? 0) >= filterOpts.minChange!);
    }
    if (filterOpts.maxChange !== null && isFinite(filterOpts.maxChange)) {
      data = data.filter(c => (c.changePercent24h ?? 0) <= filterOpts.maxChange!);
    }
    if (filterOpts.onlyGainers) {
      data = data.filter(c => (c.change24h ?? 0) > 0);
    }
    if (filterOpts.onlyLosers) {
      data = data.filter(c => (c.change24h ?? 0) < 0);
    }
    if (filterOpts.favoritesOnly) {
      const favorites = this.favoriteCurrencies();
      data = data.filter(c => favorites.includes(c.code));
    }
    if (filterOpts.minRate !== null && isFinite(filterOpts.minRate)) {
      data = data.filter(c => c.rate >= filterOpts.minRate!);
    }
    if (filterOpts.maxRate !== null && isFinite(filterOpts.maxRate)) {
      data = data.filter(c => c.rate <= filterOpts.maxRate!);
    }
    
    const sorted = this.sortColumn() ? this.applySorting(data) : data;
    return sorted;
  });

  paginatedCurrencies = computed(() => {
    const filtered = this.filteredCurrencies();
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return filtered.slice(start, end);
  });

  totalPages = computed(() => {
    const filtered = this.filteredCurrencies();
    const size = this.pageSize();
    return Math.ceil(filtered.length / size);
  });

  hasSelection = computed(() => this.selectedCurrencies().length > 0);

  constructor(
    private readonly currencyService: CurrencyService,
    public readonly translation: TranslationService
  ) {
    this.loadFavorites();
    
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
    });
  }

  ngOnInit(): void {
    this.loadRates();
  }

  loadRates(): void {
    this.loading.set(true);
    this.error.set(null);

    this.currencyService.getCurrencyData().pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError(() => {
        this.error.set(this.translation.translate('cards.error'));
        this.loading.set(false);
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.currencies.set(data);
        this.loading.set(false);
      }
    });
  }

  sort(column: 'code' | 'rate'): void {
    const sanitizedColumn = this.sanitizeInput(column);
    if (!['code', 'rate'].includes(sanitizedColumn)) {
      return;
    }
    
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
    this.currentPage.set(1);
  }

  private applySorting(data: CurrencyData[]): CurrencyData[] {
    const column = this.sortColumn();
    const direction = this.sortDirection();
    if (!column) return data;

    return [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (column) {
        case 'code':
          aVal = this.sanitizeCurrencyCode(a.code);
          bVal = this.sanitizeCurrencyCode(b.code);
          break;
        case 'rate':
          aVal = isFinite(a.rate) ? a.rate : 0;
          bVal = isFinite(b.rate) ? b.rate : 0;
          break;
        default:
          return 0;
      }

      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  toggleSelection(code: string): void {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    if (!sanitizedCode) return;
    
    const selected = this.selectedCurrencies();
    if (selected.includes(sanitizedCode)) {
      this.selectedCurrencies.set(selected.filter(c => c !== sanitizedCode));
    } else {
      this.selectedCurrencies.set([...selected, sanitizedCode]);
    }
  }

  toggleSelectAll(): void {
    const filtered = this.filteredCurrencies();
    const selected = this.selectedCurrencies();
    if (selected.length === filtered.length && filtered.length > 0) {
      this.selectedCurrencies.set([]);
    } else {
      this.selectedCurrencies.set(filtered.map(c => c.code));
    }
  }

  toggleFavorite(code: string): void {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    if (!sanitizedCode) return;
    
    const favorites = this.favoriteCurrencies();
    if (favorites.includes(sanitizedCode)) {
      this.favoriteCurrencies.set(favorites.filter(c => c !== sanitizedCode));
    } else {
      this.favoriteCurrencies.set([...favorites, sanitizedCode]);
    }
    this.saveFavorites();
  }

  isFavorite(code: string): boolean {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    return sanitizedCode ? this.favoriteCurrencies().includes(sanitizedCode) : false;
  }

  private loadFavorites(): void {
    try {
      const saved = localStorage.getItem('aurafx-rate-favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .filter((c): c is string => typeof c === 'string')
            .map(c => this.sanitizeCurrencyCode(c))
            .filter(c => c.length === 3);
          this.favoriteCurrencies.set(sanitized);
        }
      }
    } catch {
      this.favoriteCurrencies.set([]);
    }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem('aurafx-rate-favorites', JSON.stringify(this.favoriteCurrencies()));
    } catch {
    }
  }

  toggleColumn(column: keyof ColumnVisibility): void {
    const visibility = this.columnVisibility();
    this.columnVisibility.set({
      ...visibility,
      [column]: !visibility[column]
    });
  }

  isColumnVisible(column: string): boolean {
    const col = column as keyof ColumnVisibility;
    return this.columnVisibility()[col] ?? false;
  }

  toggleColumnByString(column: string): void {
    const sanitized = this.sanitizeInput(column);
    const validColumns: (keyof ColumnVisibility)[] = ['code', 'name', 'rate'];
    if (validColumns.includes(sanitized as keyof ColumnVisibility)) {
      this.toggleColumn(sanitized as keyof ColumnVisibility);
    }
  }

  clearFilters(): void {
    this.filters.set({
      minChange: null,
      maxChange: null,
      onlyGainers: false,
      onlyLosers: false,
      favoritesOnly: false,
      minRate: null,
      maxRate: null
    });
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  updateSearchTerm(value: string): void {
    const sanitized = this.sanitizeInput(value);
    this.searchSubject.next(sanitized);
  }

  updateFilter<K extends keyof FilterOptions>(key: K, value: FilterOptions[K]): void {
    const current = this.filters();
    this.filters.set({ ...current, [key]: value });
    this.currentPage.set(1);
  }

  exportCSV(): void {
    const data = this.selectedCurrencies().length > 0
      ? this.currencies().filter(c => this.selectedCurrencies().includes(c.code))
      : this.filteredCurrencies();
    
    const headers = [
      this.translation.translate('rates.code'),
      this.translation.translate('rates.name'),
      this.translation.translate('rates.rate'),
      this.translation.translate('rates.change24h'),
      this.translation.translate('rates.changePercent')
    ];
    
    const rows = data.map(c => [
      this.sanitizeCurrencyCode(c.code),
      this.sanitizeInput(c.name),
      isFinite(c.rate) ? c.rate.toFixed(4) : '0.0000',
      isFinite(c.change24h ?? 0) ? (c.change24h ?? 0).toFixed(4) : '0.0000',
      isFinite(c.changePercent24h ?? 0) ? (c.changePercent24h ?? 0).toFixed(2) : '0.00'
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const sanitizedFilename = this.sanitizeFilename('rates.csv');
    this.downloadFile(csv, sanitizedFilename, 'text/csv');
  }

  exportJSON(): void {
    const data = this.selectedCurrencies().length > 0
      ? this.currencies().filter(c => this.selectedCurrencies().includes(c.code))
      : this.filteredCurrencies();
    
    const sanitized = data.map(c => ({
      code: this.sanitizeCurrencyCode(c.code),
      name: this.sanitizeInput(c.name),
      rate: isFinite(c.rate) ? c.rate : 0,
      change24h: isFinite(c.change24h ?? 0) ? (c.change24h ?? 0) : 0,
      changePercent24h: isFinite(c.changePercent24h ?? 0) ? (c.changePercent24h ?? 0) : 0
    }));
    
    const json = JSON.stringify(sanitized, null, 2);
    const sanitizedFilename = this.sanitizeFilename('rates.json');
    this.downloadFile(json, sanitizedFilename, 'application/json');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        link.remove();
      }, 100);
    } catch {
      this.error.set(this.translation.translate('rates.exportError'));
    }
  }

  addToComparison(code: string): void {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    if (!sanitizedCode) return;
    
    const comparison = this.comparisonCurrencies();
    if (!comparison.includes(sanitizedCode) && comparison.length < 5) {
      this.comparisonCurrencies.set([...comparison, sanitizedCode]);
    }
  }

  removeFromComparison(code: string): void {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    if (!sanitizedCode) return;
    
    this.comparisonCurrencies.set(this.comparisonCurrencies().filter(c => c !== sanitizedCode));
  }

  printTable(): void {
    window.print();
  }

  shareTable(): void {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: this.translation.translate('app.title'),
        text: this.translation.translate('rates.shareText'),
        url: url
      }).catch(() => {
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {
      });
    }
  }

  getCurrencyByCode(code: string): CurrencyData | undefined {
    const sanitizedCode = this.sanitizeCurrencyCode(code);
    return sanitizedCode ? this.currencies().find(c => c.code === sanitizedCode) : undefined;
  }

  goToPage(page: number): void {
    const total = this.totalPages();
    const validPage = Math.max(1, Math.min(page, total));
    this.currentPage.set(validPage);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push(-1);
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push(-1);
        for (let i = total - 4; i <= total; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1);
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push(-1);
        pages.push(total);
      }
    }
    
    return pages;
  }

  trackByCurrencyCode(_index: number, currency: CurrencyData): string {
    return currency.code;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByPageNumber(_index: number, page: number): number {
    return page;
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return '';
    return code.replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 3);
  }

  private sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[<>\"'&]/g, '').trim();
  }

  private sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') return 'export';
    return filename.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 100) || 'export';
  }
}
