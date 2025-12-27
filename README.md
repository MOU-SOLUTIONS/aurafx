<<<<<<< HEAD
Alpha Vault
License Java Angular MySQL Build

A full-stack personal finance platform built with Spring Boot (Java) and Angular, designed for tracking income, expenses, budgets, savings, debts, and investments — with powerful analytics and responsive UI.

📂 Project Structure
/Backend → Spring Boot REST API
Modules: Income, Expense, Budget, Saving Goal, Debt (with payment history), Investment
JWT authentication (pre-wired), analytics endpoints (daily, weekly, monthly, yearly)
MySQL database integration
/Frontend → Angular single-page application
Responsive dashboard with charts, tables, and filters
SEO-ready components, Bootstrap grid system
Parent→child data flow with OnPush change detection
🚀 Features
Authentication → JWT-based secure login
Income & Expense Tracking → CRUD + analytics
Budgeting → Monthly budgets by category with remaining balance tracking
Saving Goals → Progress bars, deadlines, priority indicators
Debt Management → Track remaining amounts, due dates, interest
Investments → Manual + dynamic (crypto, stocks, etc.)
Analytics → Chart-ready data (category breakdowns, payment methods, top 5 lists)
🛠️ Tech Stack
Backend:

Java 17, Spring Boot, Spring Data JPA, MySQL, JWT Security
Frontend:
Angular, RxJS, Bootstrap, Chart.js
📦 Getting Started
Follow these steps to run Alpha Vault locally:

1️⃣ Clone the repository
git clone https://github.com/MOU-SOLUTIONS/Alpha-vault.git
cd Alpha-vault
=======
# AuraFX
![License](https://img.shields.io/badge/License-Non--Commercial-blue)
![Java](https://img.shields.io/badge/Java-17-orange)
![Angular](https://img.shields.io/badge/Angular-17-red)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen)

A **high-performance forex analytics platform** built with **Angular**, designed to provide real-time currency exchange rates, multi-currency conversion, historical data charts, and advanced market insights with a sleek, responsive UI.

---

## 📂 Project Structure
- **`/Frontend`** → Angular single-page application
  - Standalone components with OnPush change detection  
  - Signal-based reactive state management  
- **`/src/app/components`** → Modular UI  
  - Dashboard, Currency Converter, Rates Table, Currency Charts  

---

## 🚀 Features
1. **Dashboard**
+ Market overview with top gainers/losers
+ Base currency selector and 24h change indicators
+ Currency analytics cards and visual trends
+ Auto-refresh and manual update capability

2. **Currency Converter**
+ Single & multi-currency conversion
+ Historical conversions with date picker
+ Favorite currencies & conversion history
+ Instant feedback and input validation

3. **Exchange Rates Table**
+ Real-time rates for all tracked currencies
+ Advanced filtering, sorting, pagination
+ Export as CSV/JSON, print, or share
+ Favorites & multi-currency comparison

4. **Currency Charts**
+ Historical line, bar, and area charts
+ Multi-currency overlay
+ Technical indicators (MA, EMA)
+ Export charts to PNG

5. **Navigation**
+ Language selector (EN, ES, FR)
+ Theme toggle (Dark/Light)
+ Active route highlighting & responsive mobile menu

6. **Market Overview**
+ Strength indices for top/weakest currencies
+ Performance metrics & trend analysis

---

## 🛠️ Tech Stack
**Framework:** Angular 21, Standalone Components, TypeScript 5.9
**UI & Styling:** SCSS, BEM methodology, Angular Material, CSS Grid & Flexbox
**Charts & Visualization:** Chart.js, ng2-charts
**Mapping & Analytics:** Leaflet.js (planned), Currency analytics
**State Management:** Angular Signals, RxJS Observables
**Internationalization:** @ngx-translate/core
**Testing:** Vitest + jsdom
**Build & Dev Tools:** Angular CLI, Prettier, ESLint

---

## 📦 Getting Started
Follow these steps to run Alpha Vault locally:

### 1️⃣ Clone the repository
```bash
git clone https://github.com/MOU-SOLUTIONS/aurafx.git
cd aurafx
>>>>>>> 3a7c52e (docs: update README and LICENSE)
