AuraFX

License: MIT
Framework: Angular 21 + TypeScript
Deployment: Vercel / Static Hosting

A high-performance Forex Exchange Rates & Currency Analytics platform built with Angular. Monitor real-time currency exchange rates, perform multi-currency conversions, visualize historical trends, and gain advanced market insights—all with a sleek, responsive UI.

📂 Project Structure
src/app/components       → Modular UI architecture
src/app/services         → Business logic and API management
src/app/models           → TypeScript interfaces
src/app/pages            → Core views (Dashboard, Converter, Rates, Charts)
src/assets/i18n          → Multi-language support (EN, ES, FR)
public/                  → Public assets (logos, favicons)

🚀 Features
Dashboard

Real-time currency exchange rates

Market overview (top gainers/losers)

Analytics cards with trends

Base currency selector

Auto-refresh and manual update

Currency Converter

Single & multi-currency conversion

Historical conversion support

Favorite currencies & conversion history

Input validation and instant feedback

Exchange Rates Table

Comprehensive currency list

Advanced filtering, sorting, and pagination

Export as CSV/JSON

Favorites & comparison tools

Currency Charts

Line, bar, and area charts

Multi-currency overlays

Technical indicators (MA, EMA)

Export charts as PNG

Navigation

Route navigation with active state

Theme toggle (Dark/Light)

Language selector (EN, ES, FR)

Responsive mobile menu

Market Overview

Currency strength indices

Top gainers & losers

Visual performance metrics

🛠️ Tech Stack

Angular 21 (Standalone Components, Signals)

TypeScript 5.9 (Strict mode)

SCSS & BEM methodology for styling

Angular Material & CDK

Chart.js / ng2-charts for data visualization

RxJS for reactive data flow

@ngx-translate/core for i18n

Vitest + jsdom for testing

📦 Getting Started
git clone https://github.com/MOU-SOLUTIONS/aurafx.git
cd aurafx
npm install
npm start        # Run dev server on port 4200
npm run build    # Production build

🌍 Internationalization

Supported languages: English, Spanish, French

Reactive translation updates using signals

Browser language detection & LocalStorage persistence

⚡ Performance Optimizations

OnPush change detection + signal-based state

Lazy-loaded routes and standalone components

API & translation caching (5 min TTL)

Input debouncing, minimal DOM re-rendering

Tree-shaking, minification, Gzip/Brotli compression

🔐 Security

Input validation & sanitization

XSS prevention & safe HTML bindings

User-friendly error handling

LocalStorage validation

🧩 Future Enhancements

User accounts & personalized dashboards

Advanced analytics & alerts

Social sharing & community features

Mobile apps & offline support

Real-time WebSocket updates & GraphQL API

Additional languages & RTL support

✅ Conclusion

AuraFX is a modern, scalable, and secure forex analytics platform, combining real-time data, historical insights, and advanced analytics in a high-performance Angular application with a responsive and internationalized interface.

Last Updated: 2025-12-27
Maintained By: Mohamed Dhaoui
License: MIT (see LICENSE file)