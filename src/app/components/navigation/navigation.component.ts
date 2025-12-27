// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslationService, Language } from '../../services/translation.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavigationComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly translation = inject(TranslationService);

  readonly currentLanguage = signal<Language>('en');
  
  readonly dashboardLabel = computed(() => {
    this.translation.currentLanguage();
    return this.translation.translate('nav.dashboard');
  });
  readonly converterLabel = computed(() => {
    this.translation.currentLanguage();
    return this.translation.translate('nav.converter');
  });
  readonly ratesLabel = computed(() => {
    this.translation.currentLanguage();
    return this.translation.translate('nav.rates');
  });
  readonly chartsLabel = computed(() => {
    this.translation.currentLanguage();
    return this.translation.translate('nav.charts');
  });

  readonly languages: readonly { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' }
  ] as const;

  ngOnInit(): void {
    this.translation.getCurrentLanguage()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.currentLanguage.set('en');
          return of('en');
        })
      )
      .subscribe(lang => {
        const sanitized = this.sanitizeLanguage(lang);
        this.currentLanguage.set(sanitized);
      });
  }

  changeLanguage(lang: Language): void {
    const sanitizedLang = this.sanitizeLanguage(lang);
    if (sanitizedLang !== this.currentLanguage()) {
      this.translation.setLanguage(sanitizedLang);
      this.currentLanguage.set(sanitizedLang);
    }
  }

  trackByLanguageCode(_index: number, lang: { code: Language; name: string }): Language {
    return lang.code;
  }

  private sanitizeLanguage(lang: unknown): Language {
    if (typeof lang === 'string' && ['en', 'es', 'fr'].includes(lang)) {
      return lang as Language;
    }
    return 'en';
  }
}
