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

`App.jsx` съдържа: връзката към Supabase (горе), helper-и (`rest`, `login`, `signup`, data функции),
и компонентите `App`, `BottomNav`, `ProductCard`, `Shop` (Начало), `FavoritesPage` (Любими),
`CartPage` (Количка), `ProfilePage` + `CustomerAuth` (Профил), `ProductPage`, `AuthGate`, `Admin`,
`Orders`, `ProductsAdmin`, `ProductForm`, `SettingsPanel`, `Checkout`, `Drawer`, `Modal`, `Style`.

Клиентската част е с долна навигация (`BottomNav`) и hash-маршрути: `#` (Начало), `#favorites`,
`#cart`, `#profile`, `#product/<id>`, `#admin`. Любимите се пазят в `localStorage` (`favorites`).

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
- `orders` — id, created_at, customer_name/phone/city/address, notes, items (jsonb), total, currency, payment, status,
  `user_id` (акаунт на клиента, `default auth.uid()`; null за анонимни поръчки)
- `shop_settings` — един ред (id=1): shop_name, tagline, currency

Тригер `trg_decrement_stock` (функция `decrement_stock_on_order`, SECURITY DEFINER) намалява
`products.stock` при всяка нова поръчка (заобикаля RLS, за да работи и при анонимни/клиентски поръчки).

### RLS правила (важно!)

Админ операциите са заключени до имейла на админа (`auth.jwt()->>'email' = 'dimitrkuzmanov3@gmail.com'`),
защото има **публична регистрация** на клиенти — иначе всеки регистрирал се би получил админ права.

- `products`: всеки чете; пише само админ имейлът.
- `orders`: всеки (анонимен) може да **създаде** поръчка; чете/променя/трие само админ имейлът.
- `shop_settings`: всеки чете; променя само админ имейлът.
- `storage/product-images`: всеки чете; качва/трие само админ имейлът.

Затова анонимното записване на поръчка използва `Prefer: return=minimal` (иначе четенето обратно
пада заради RLS). Ако смениш админ имейла, трябва да обновиш и тези политики.

### Автентикация

Има два вида вход, и двата през Supabase Auth (GoTrue), но с различно поведение:

- **Админ** (иконата ⚙️ → `#admin`): JWT само в React state (не се пази) — при презареждане иска
  парола наново; формата е с изключен `autocomplete`. Акаунтът се създава ръчно от таблото:
  Authentication → Users → Add user.
- **Клиент** (таб „Профил“ → `#profile`): вход и **регистрация** (`/auth/v1/signup`). Сесията се
  пази в `localStorage` (`customer_session`) и се подновява с refresh token при отваряне. Клиентите
  нямат админ права (виж RLS). Ако в Supabase е включено потвърждение по имейл, регистрацията
  връща потребител без сесия и се показва подкана да се потвърди имейлът.

## Статуси на поръчка

`нова` → `изпратена` → `приключена` (или `отказана`). Пази точно тези низове — CSS класовете зависят от тях.

## Все още за правене (TODO)

1. ~~Сигурност: заключи write-правилата до имейла на админа.~~ **Готово** — админ операциите са
   заключени до `dimitrkuzmanov3@gmail.com`; публичната регистрация е за клиенти без админ права.
2. ~~Качване на снимки на продукти (Supabase Storage).~~ **Готово.**
3. Картови плащания (напр. Stripe) — сега е само наложен платеж.
4. Имейл известие при нова поръчка.
5. ~~Свързване на поръчките с клиентския акаунт (история в „Профил“).~~ **Готово** — клиентът вижда
   своите поръчки в „Профил“ (с дата) и може да отказва поръчка, докато е със статус `нова`.

## Стил на кода

- Кратки функционални компоненти, `useState`/`useEffect`, без външни state библиотеки.
- Всички suми минават през `money(n, currency)`.
- Не добавяй TypeScript и не сменяй стека без причина.
