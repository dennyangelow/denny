# 🍅 Denny Angelow — Маркетинг Система v2

Next.js 14 + Supabase маркетинг и e-commerce система с пълен Admin панел.

---

## 📁 Нова структура на файловете

```
dennyangelow/
├── app/
│   ├── layout.tsx                        ← Root layout + SEO + fonts
│   ├── page.tsx                          ← Главна маркетинг страница
│   ├── admin/
│   │   ├── page.tsx                      ← Admin панел (само layout + hooks)
│   │   ├── login/
│   │   │   └── page.tsx                  ← Login страница
│   │   └── components/
│   │       ├── Sidebar.tsx               ← Странична навигация
│   │       ├── DashboardTab.tsx          ← Дашборд + Recharts графика
│   │       ├── OrdersTab.tsx             ← Таблица с поръчки + филтри + пагинация
│   │       ├── OrderModal.tsx            ← Детайли на поръчка + смяна на статус
│   │       ├── LeadsTab.tsx              ← Email листа + CSV export
│   │       ├── AnalyticsTab.tsx          ← Всички графики (Bar, Pie, Area)
│   │       └── SettingsTab.tsx           ← Системна информация + ENV статус
│   └── api/
│       ├── admin/auth/route.ts           ← Login/logout endpoint
│       ├── orders/route.ts               ← GET/POST поръчки
│       ├── orders/[id]/route.ts          ← PATCH/GET поръчка по ID
│       ├── leads/route.ts                ← GET/POST leads
│       └── analytics/affiliate-click/   ← GET/POST кликове
│           └── route.ts
├── components/
│   └── ui/
│       └── Toast.tsx                     ← Toast нотификации
├── hooks/
│   └── useAdminData.ts                   ← Custom hook за всички admin данни
├── lib/
│   ├── supabase.ts                       ← Supabase клиент + TypeScript типове
│   └── constants.ts                      ← STATUS_LABELS, NAV_ITEMS и др.
├── middleware.ts                          ← Auth защита на /admin
├── supabase-schema.sql
├── .env.example
└── package.json
```

---

## ✨ Нови подобрения в v2

### Admin панел
- **Recharts графики** — Area chart за приходите, Bar chart, Pie charts за статуси и плащания
- **Toast нотификации** — при смяна на статус, копиране, export
- **Пагинация** — 15 поръчки/20 leads на страница
- **CSV export** — с BOM за коректно кирилско кодиране в Excel
- **Копиране на имейли** — един клик за всички активни абонати
- **Копиране на телефон** — директно от modal-а на поръчка
- **Mobile sidebar** — drawer на мобилни устройства
- **Error state** — при проблем с мрежата показва съобщение + retry бутон
- **UTM tracking** — вижда се в modal-а на поръчката

### Сигурност
- **Auth middleware** — защита на `/admin` с парола (cookie-based)
- **Login страница** — `/admin/login` с форма
- **Logout API** — `DELETE /api/admin/auth`

### Код качество
- **Разделени компоненти** — всеки tab е отделен файл (~100-200 реда)
- **Custom hook** — `useAdminData` извлича всички данни и state логиката
- **Централни константи** — `lib/constants.ts` — без дублиране
- **TypeScript** — пълни типове навсякъде

---

## 🚀 Инсталация

### 1. Инсталирай зависимостите
```bash
npm install
```

### 2. Настрой .env.local
```bash
cp .env.example .env.local
# Попълни всички стойности
```

### 3. Задължително — смени ADMIN_SECRET!
```env
ADMIN_SECRET=супер-сложна-парола-минимум-20-символа
```

### 4. Изпълни SQL схемата в Supabase
```sql
-- Копирай supabase-schema.sql в Supabase SQL Editor и изпълни
```

### 5. Стартирай
```bash
npm run dev
# Admin: http://localhost:3000/admin
```

---

## 🔐 Admin достъп

1. Отиди на `/admin` → автоматично redirect към `/admin/login`
2. Въведи паролата от `ADMIN_SECRET`
3. Cookie се пази 7 дни
4. Logout: `DELETE /api/admin/auth`

Ако `ADMIN_SECRET` **не е настроен** — `/admin` е отворена (само за development)!

---

## 📊 Admin панел — функции

| Tab | Функции |
|-----|---------|
| **Дашборд** | 5 stat cards, Area chart (30 дни приход), последни поръчки, статус breakdown |
| **Поръчки** | Таблица, 6 филтъра, търсене, пагинация, modal с детайли, смяна на статус/плащане |
| **Email листа** | Таблица, CSV export, копиране на имейли, филтър активни/отписани |
| **Аналитика** | Bar chart приход, Pie статуси, Pie плащания, афилиейт bars |
| **Настройки** | Системна информация, ENV статус, бързи линкове, security напомняния |

---

## 📦 Технологии

| | |
|--|--|
| **Next.js 14** | App Router, Server Components |
| **Supabase** | PostgreSQL + RLS + Auth |
| **Recharts** | Всички графики в admin панела |
| **Resend** | Транзакционни имейли |
| **TypeScript** | Пълна типова сигурност |
| **Vercel** | Hosting (препоръчано) |
