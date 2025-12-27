// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'converter',
    loadComponent: () => import('./components/currency-converter/currency-converter.component').then(m => m.CurrencyConverterComponent)
  },
  {
    path: 'rates',
    loadComponent: () => import('./components/rates-table/rates-table.component').then(m => m.RatesTableComponent)
  },
  {
    path: 'charts',
    loadComponent: () => import('./components/currency-chart/currency-chart.component').then(m => m.CurrencyChartComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
