// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Injectable, signal, computed } from '@angular/core';

export type Language = 'en' | 'es' | 'fr';

interface TranslationEntry {
  readonly en: string;
  readonly es: string;
  readonly fr: string;
}

type Translations = Readonly<Record<string, TranslationEntry>>;

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly currentLanguage = signal<Language>('en');
  private readonly translations: Translations = {
    'app.title': {
      en: 'AuraFX - Forex Exchange Rates & Currency Converter',
      es: 'AuraFX - Tasas de Cambio y Convertidor de Monedas',
      fr: 'AuraFX - Taux de Change et Convertisseur de Devises'
    },
    'nav.dashboard': {
      en: 'Dashboard',
      es: 'Panel',
      fr: 'Tableau de bord'
    },
    'nav.converter': {
      en: 'Converter',
      es: 'Convertidor',
      fr: 'Convertisseur'
    },
    'nav.rates': {
      en: 'Exchange Rates',
      es: 'Tasas de Cambio',
      fr: 'Taux de change'
    },
    'nav.charts': {
      en: 'Charts',
      es: 'Gráficos',
      fr: 'Graphiques'
    },
    'dashboard.title': {
      en: 'Forex Dashboard',
      es: 'Panel de Forex',
      fr: 'Tableau de bord Forex'
    },
    'dashboard.latestRates': {
      en: 'Latest Exchange Rates',
      es: 'Últimas Tasas de Cambio',
      fr: 'Derniers taux de change'
    },
    'dashboard.baseCurrency': {
      en: 'Base Currency',
      es: 'Moneda Base',
      fr: 'Devise de base'
    },
    'dashboard.lastUpdated': {
      en: 'Last Updated',
      es: 'Última Actualización',
      fr: 'Dernière mise à jour'
    },
    'converter.title': {
      en: 'Currency Converter',
      es: 'Convertidor de Monedas',
      fr: 'Convertisseur de devises'
    },
    'converter.from': {
      en: 'From',
      es: 'De',
      fr: 'De'
    },
    'converter.to': {
      en: 'To',
      es: 'A',
      fr: 'À'
    },
    'converter.amount': {
      en: 'Amount',
      es: 'Cantidad',
      fr: 'Montant'
    },
    'converter.convert': {
      en: 'Convert',
      es: 'Convertir',
      fr: 'Convertir'
    },
    'converter.result': {
      en: 'Result',
      es: 'Resultado',
      fr: 'Résultat'
    },
    'rates.title': {
      en: 'Exchange Rates',
      es: 'Tasas de Cambio',
      fr: 'Taux de change'
    },
    'rates.currency': {
      en: 'Currency',
      es: 'Moneda',
      fr: 'Devise'
    },
    'rates.rate': {
      en: 'Rate',
      es: 'Tasa',
      fr: 'Taux'
    },
    'rates.change': {
      en: 'Change',
      es: 'Cambio',
      fr: 'Changement'
    },
    'rates.change24h': {
      en: '24h Change',
      es: 'Cambio 24h',
      fr: 'Changement 24h'
    },
    'charts.title': {
      en: 'Currency Charts',
      es: 'Gráficos de Monedas',
      fr: 'Graphiques de devises'
    },
    'charts.selectCurrency': {
      en: 'Select Currency',
      es: 'Seleccionar Moneda',
      fr: 'Sélectionner la devise'
    },
    'charts.timeRange': {
      en: 'Time Range',
      es: 'Rango de Tiempo',
      fr: 'Plage de temps'
    },
    'charts.1week': {
      en: '1 Week',
      es: '1 Semana',
      fr: '1 Semaine'
    },
    'charts.1month': {
      en: '1 Month',
      es: '1 Mes',
      fr: '1 Mois'
    },
    'charts.3months': {
      en: '3 Months',
      es: '3 Meses',
      fr: '3 Mois'
    },
    'charts.6months': {
      en: '6 Months',
      es: '6 Meses',
      fr: '6 Mois'
    },
    'charts.1year': {
      en: '1 Year',
      es: '1 Año',
      fr: '1 An'
    },
    'common.loading': {
      en: 'Loading...',
      es: 'Cargando...',
      fr: 'Chargement...'
    },
    'common.error': {
      en: 'Error loading data',
      es: 'Error al cargar datos',
      fr: 'Erreur lors du chargement des données'
    },
    'common.refresh': {
      en: 'Refresh',
      es: 'Actualizar',
      fr: 'Actualiser'
    }
  } as const;

  readonly language = computed(() => this.currentLanguage());

  constructor() {
    this.initializeLanguage();
  }

  setLanguage(lang: Language): void {
    const sanitized = this.sanitizeLanguage(lang);
    if (sanitized !== this.currentLanguage()) {
      this.currentLanguage.set(sanitized);
      this.updateDocumentLanguage(sanitized);
      this.saveLanguageToStorage(sanitized);
    }
  }

  translate(key: string): string {
    const sanitizedKey = this.sanitizeKey(key);
    const translation = this.translations[sanitizedKey];
    
    if (!translation) {
      return sanitizedKey;
    }

    const lang = this.currentLanguage();
    return translation[lang] || translation.en;
  }

  translateSignal(key: string) {
    return computed(() => {
      this.currentLanguage();
      return this.translate(key);
    });
  }

  init(): void {
    this.initializeLanguage();
  }

  private initializeLanguage(): void {
    const savedLang = this.loadLanguageFromStorage();
    if (savedLang) {
      this.setLanguage(savedLang);
      return;
    }

    const browserLang = this.detectBrowserLanguage();
    if (browserLang) {
      this.setLanguage(browserLang);
    }
  }

  private loadLanguageFromStorage(): Language | null {
    try {
      const saved = localStorage.getItem('aurafx-language');
      if (typeof saved === 'string') {
        return this.sanitizeLanguage(saved);
      }
    } catch {
    }
    return null;
  }

  private saveLanguageToStorage(lang: Language): void {
    try {
      localStorage.setItem('aurafx-language', lang);
    } catch {
    }
  }

  private detectBrowserLanguage(): Language | null {
    try {
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang) {
        return this.sanitizeLanguage(browserLang);
      }
    } catch {
    }
    return null;
  }

  private updateDocumentLanguage(lang: Language): void {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = lang;
      }
    } catch {
    }
  }

  private sanitizeLanguage(lang: unknown): Language {
    if (typeof lang !== 'string' || !lang) {
      return 'en';
    }
    const normalized = lang.trim().toLowerCase().slice(0, 2);
    if (normalized === 'en' || normalized === 'es' || normalized === 'fr') {
      return normalized;
    }
    return 'en';
  }

  private sanitizeKey(key: unknown): string {
    if (typeof key !== 'string' || !key) {
      return '';
    }
    return key.trim().replace(/[<>\"'&]/g, '').slice(0, 200);
  }
}
