AuraFX

License Angular TypeScript Vercel

A high-performance forex analytics platform built with Angular, designed to provide real-time currency exchange rates, multi-currency conversion, historical data charts, and advanced market insights with a sleek, responsive UI.

📂 Project Structure
/Frontend → Angular SPA

Standalone components with OnPush change detection

Signal-based reactive state management
/src/app/components → Modular UI

Dashboard, Currency Converter, Rates Table, Currency Charts
/src/app/services → Business logic & API integration
/src/app/models → TypeScript interfaces
/src/assets/i18n → Multi-language support (EN, ES, FR)
/public → Public assets (logo, favicon)

🚀 Features

Dashboard → Real-time rates, top gainers/losers, market analytics

Currency Converter → Single/multi conversion, historical rates, favorites

Exchange Rates Table → Filter, search, sort, export CSV/JSON

Currency Charts → Line, bar, area charts, multi-currency comparison

Navigation → Theme toggle (Dark/Light), language selector, responsive menu

Market Overview → Currency strength, top movers, visual metrics

🛠️ Tech Stack

Frontend: Angular 21, TypeScript 5.9, SCSS, Angular Material, RxJS, Chart.js / ng2-charts, @ngx-translate/core
Utilities: Vitest + jsdom (testing), Prettier (formatting), Responsive grid system

📦 Getting Started
1️⃣ Clone the repository

git clone https://github.com/MOU-SOLUTIONS/aurafx.git
cd aurafx


2️⃣ Install dependencies

npm install


3️⃣ Run development server

npm start  # Default port 4200


4️⃣ Build for production

npm run build  # Output in dist/