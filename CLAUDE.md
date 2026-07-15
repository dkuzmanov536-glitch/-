# CLAUDE.md

Контекст за проекта, който Claude Code чете автоматично. / Project context auto-read by Claude Code.

## Какво е това

Онлайн магазин за физически продукти с доставка. Един собственик = един администратор.
Клиентите разглеждат продукти, добавят в количка и правят поръчка (плащане: наложен платеж).
Администраторът управлява продукти, вижда поръчки и сменя статуси.

Целият интерфейс е на **български**. Пази UI текстовете на български.

## Технологии

- **Frontend:** Vite + React (без TypeScript), икони от `lucide-react`.
- **Backend:** Supabase (PostgreSQL + Auth). Достъпва се директно през REST (`fetch`), **без** библиотеката `@supabase/supabase-js`.
- Стиловете са CSS, инжектиран чрез компонента `<Style>` в `App.jsx` (един `<style>` таг). Няма Tailwind.

## Структура

```
src/
  App.jsx    # цялото приложение: витрина + количка + поръчка + админ панел
  main.jsx   # входна точка (createRoot)
index.html
```

`App.jsx` съдържа: връзката към Supabase (горе), helper-и (`rest`, `login`, data функции),
и компонентите `App`, `Shop`, `AuthGate`, `Admin`, `Orders`, `ProductsAdmin`, `ProductForm`,
`SettingsPanel`, `Checkout`, `Drawer`, `Modal`, `Style`.

## Команди

```bash
npm install     # инсталира зависимости
npm run dev     # локален сървър за разработка
npm run build   # продукшън билд в dist/
npm run preview # преглед на билда
```

## Supabase

- **Project ref:** `epapcmyvwyvwdjcrvprj`
- **URL:** `https://epapcmyvwyvwdjcrvprj.supabase.co`
- **Публичен ключ (publishable):** `sb_publishable_Y7xrMB7N0j4IH_iyvYFGRQ_21SgE6xa`
  Този ключ е **безопасен** за клиентски код и за публично репо — сигурността идва от RLS, не от тайна на ключа.
- **НИКОГА не качвай** `service_role` ключа в кода или репото.

### Таблици

- `products` — id, name, price, category, image (емоджи или URL), stock, description, created_at
- `orders` — id, created_at, customer_name/phone/city/address, notes, items (jsonb), total, currency, payment, status
- `shop_settings` — един ред (id=1): shop_name, tagline, currency

### RLS правила (важно!)

- `products`: всеки чете; само `authenticated` пише.
- `orders`: всеки (анонимен) може да **създаде** поръчка; само `authenticated` чете/променя.
- `shop_settings`: всеки чете; само `authenticated` променя.

Затова анонимното записване на поръчка използва `Prefer: return=minimal` (иначе четенето обратно
пада заради RLS).

### Автентикация

Админ входът е през Supabase Auth (имейл + парола, GoTrue endpoint `/auth/v1/token`).
Сесията (вкл. `refresh_token`) се пази в `localStorage` под ключ `admin_session`; при
отваряне се подновява автоматично с refresh token, за да не се въвежда парола всеки път.
„Изход“ изчиства сесията. Админ акаунтът се създава ръчно от таблото: Authentication → Users → Add user.

## Статуси на поръчка

`нова` → `изпратена` → `приключена` (или `отказана`). Пази точно тези низове — CSS класовете зависят от тях.

## Все още за правене (TODO)

1. **Сигурност преди пускане онлайн:** заключи write-правилата само до имейла на админа
   (напр. `using (auth.jwt()->>'email' = 'моят@имейл')`) и изключи публичната регистрация в Supabase,
   иначе всеки може да си направи акаунт и да получи админ права.
2. Качване на снимки на продукти (Supabase Storage), вместо само емоджи/URL.
3. Картови плащания (напр. Stripe) — сега е само наложен платеж.
4. Имейл известие при нова поръчка.

## Стил на кода

- Кратки функционални компоненти, `useState`/`useEffect`, без външни state библиотеки.
- Всички suми минават през `money(n, currency)`.
- Не добавяй TypeScript и не сменяй стека без причина.
