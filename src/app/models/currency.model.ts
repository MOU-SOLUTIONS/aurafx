// Project: AuraFX | Author: Mohamed Dhaoui | Date: 2024-12-26

export interface Currency {
  code: string;
  name: string;
}

export interface ExchangeRate {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface HistoricalRate {
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

export interface CurrencyData {
  code: string;
  name: string;
  rate: number;
  change24h?: number;
  changePercent24h?: number;
}
