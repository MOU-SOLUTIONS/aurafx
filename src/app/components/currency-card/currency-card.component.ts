// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, Input, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyData } from '../../models/currency.model';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-currency-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './currency-card.component.html',
  styleUrl: './currency-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrencyCardComponent {
  readonly translation = inject(TranslationService);

  @Input({ required: true }) currency!: CurrencyData;
  @Input() baseCurrency: string = 'EUR';

  readonly sanitizedBaseCurrency = computed(() => this.sanitizeCurrencyCode(this.baseCurrency));

  readonly sanitizedCurrencyCode = computed(() => {
    if (!this.currency?.code) return 'EUR';
    return this.sanitizeCurrencyCode(this.currency.code);
  });

  readonly hasChange = computed(() => {
    const change = this.currency?.change24h;
    return change !== undefined && change !== null && isFinite(change);
  });

  readonly isPositive = computed(() => {
    const change = this.currency?.change24h ?? 0;
    return isFinite(change) && change >= 0;
  });

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

  getCurrencyName(): string {
    return this.currency?.name || this.sanitizedCurrencyCode();
  }

  private sanitizeCurrencyCode(code: string): string {
    if (!code || typeof code !== 'string') return 'EUR';
    const sanitized = code.trim().toUpperCase().slice(0, 3);
    return /^[A-Z]{3}$/.test(sanitized) ? sanitized : 'EUR';
  }
}
