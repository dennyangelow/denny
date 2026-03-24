# 🍅 Denny Angelow — Пълна Маркетинг Система

Next.js 14 + Supabase маркетинг и e-commerce система за dennyangelow.com

---

## 📋 Структура на системата

```
dennyangelow/
├── app/
│   ├── page.tsx              ← Главна маркетинг страница
│   ├── layout.tsx            ← Root layout + SEO metadata
│   ├── admin/
│   │   └── page.tsx          ← Пълен админ панел
│   └── api/
│       ├── orders/
│       │   ├── route.ts      ← GET/POST поръчки
│       │   └── [id]/route.ts ← PATCH статус на поръчка
│       ├── leads/
│       │   └── route.ts      ← GET/POST email абонати
│       └── analytics/
│           └── affiliate-click/route.ts ← Проследяване кликове
├── lib/
│   └── supabase.ts           ← Supabase клиент + TypeScript типове
├── supabase-schema.sql       ← Цялата база данни (изпълни в Supabase)
├── .env.example              ← Шаблон за environment variables
└── package.json
```

---

## 🚀 Инсталация (стъпка по стъпка)

### 1. Клонирай и инсталирай

```bash
cd dennyangelow
npm install
```

### 2. Създай Supabase проект

1. Отиди на [supabase.com](https://supabase.com) → New Project
2. Избери регион: **Frankfurt** (EU, близо до България)
3. Запиши: Project URL и API Keys

### 3. Създай базата данни

1. В Supabase → SQL Editor
2. Копирай целия `supabase-schema.sql`
3. Изпълни → базата се създава автоматично с:
   - Таблици: orders, leads, products, affiliate_clicks, email_logs, settings
   - Автоматичен номер на поръчка (DA-2024-0001)
   - Row Level Security (RLS) политики
   - Индекси за бързина

### 4. Настрой environment variables

```bash
cp .env.example .env.local
# Попълни стойностите в .env.local
```

### 5. Настрой Resend (имейли)

1. Регистрирай се на [resend.com](https://resend.com)
2. Верифицирай домейна dennyangelow.com
3. Вземи API key → добави в .env.local

### 6. Стартирай локално

```bash
npm run dev
# Отвори http://localhost:3000
```

### 7. Deploy на Vercel

```bash
# Инсталирай Vercel CLI
npm i -g vercel

# Deploy
vercel

# Добави environment variables в Vercel Dashboard
```

---

## 🗃️ База данни — таблици

| Таблица | Описание |
|---------|----------|
| `orders` | Всички поръчки (Atlas Terra) |
| `order_items` | Продукти в поръчката |
| `leads` | Email абонати от наръчника |
| `products` | Продукти (Atlas Terra + AMINO) |
| `affiliate_clicks` | Кликове към agroapteki, oranjeriata |
| `email_logs` | История на изпратени имейли |
| `settings` | Настройки на сайта |

---

## 💰 Бизнес модел

### Директни продажби (Atlas Terra)
- Atlas Terra — 28.90 лв./кг
- Atlas Terra AMINO — 32.90 лв./л
- Поръчки с наложен платеж или банков превод
- Автоматично потвърждение по имейл

### Афилиейт приходи
- **AgroApteki** — tracking=6809eceee15ad
- **Oranjeriata** — линк към Ginegar фолиа
- Всеки клик се записва в базата данни
- Виждаш кой продукт носи повече трафик

---

## 📊 Админ панел (/admin)

- **Дашборд** — общ преглед: поръчки, приходи, абонати, кликове
- **Поръчки** — виж и управлявай поръчките, промени статус
- **Email листа** — всички абонати + export в CSV
- **Аналитика** — кликове по партньор и продукт
- **Настройки** — системна информация

---

## 📧 Email автоматизация

При изтегляне на наръчника → изпраща се welcome email с link.
При поръчка → потвърждение до клиента + нотификация до admin.

**Следваща стъпка:** Добави email последователност (5 имейла) с Resend.

---

## 🔒 Сигурност

- RLS (Row Level Security) в Supabase
- Публично: само INSERT на поръчки и leads
- Само authenticated admin: SELECT/UPDATE/DELETE
- Препоръчително: добави NextAuth.js за /admin

---

## 📱 Технологии

| Технология | Употреба |
|------------|----------|
| Next.js 14 | Framework (App Router) |
| Supabase | База данни + Auth |
| Resend | Транзакционни имейли |
| TypeScript | Типова сигурност |
| Vercel | Hosting (препоръчано) |

---

## 🆘 Поддръжка

За технически въпроси: support@dennyangelow.com
