// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Injectable, signal, computed, effect } from '@angular/core';

export type Theme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'aurafx-theme';
  private readonly DEFAULT_THEME: Theme = 'dark';
  private readonly _theme = signal<Theme>(this.loadTheme());

  readonly theme = this._theme.asReadonly();
  readonly isDark = computed(() => this._theme() === 'dark');
  readonly isLight = computed(() => this._theme() === 'light');

  constructor() {
    const initialTheme = this._theme();
    this.applyTheme(initialTheme);
    
    effect(() => {
      const currentTheme = this._theme();
      this.applyTheme(currentTheme);
      this.saveTheme(currentTheme);
    });
  }

  setTheme(theme: Theme): void {
    const sanitizedTheme = this.sanitizeTheme(theme);
    if (sanitizedTheme !== this._theme()) {
      this._theme.set(sanitizedTheme);
    }
  }

  toggleTheme(): void {
    const currentTheme = this._theme();
    const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  private loadTheme(): Theme {
    if (typeof window === 'undefined' || !window.localStorage) {
      return this.DEFAULT_THEME;
    }

    try {
      const savedTheme = localStorage.getItem(this.THEME_STORAGE_KEY);
      return this.sanitizeTheme(savedTheme);
    } catch {
      return this.DEFAULT_THEME;
    }
  }

  private saveTheme(theme: Theme): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.setItem(this.THEME_STORAGE_KEY, theme);
    } catch {
    }
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined' || !document.documentElement) {
      return;
    }

    try {
      const htmlElement = document.documentElement;
      htmlElement.setAttribute('data-theme', theme);
      htmlElement.classList.remove('theme-dark', 'theme-light');
      htmlElement.classList.add(`theme-${theme}`);
    } catch {
    }
  }

  private sanitizeTheme(theme: unknown): Theme {
    if (theme === 'dark' || theme === 'light') {
      return theme;
    }
    return this.DEFAULT_THEME;
  }
}
