# AGENTS.md — xenia

xenia is a pre-launch online shop for wine and light grape wine: Next.js (App Router) with Payload 3 embedded, on Postgres. Vietnamese is the default locale at `/`; English mirrors it under `/en` with the same slugs.

## Commands

Setup from a fresh clone:

```sh
pnpm install
cp .env.example .env     # dev-only placeholders, never real secrets
pnpm db:up               # start Postgres (only needed for /admin, /api and pnpm dev with Payload)
```

| Command | What |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm seed` | Replaces the catalogue (producers, wines, vintages) with the fictional seed in `src/seed/data.ts` and sets the delivery zones in the `site-settings` global (`ZONE_FEES`). Deterministic content; never touches `users`, `orders` or any other collection. Needs `pnpm db:up`. |
| `pnpm test:e2e` | Playwright + axe. Starts its own `next dev` on **localhost:3417** and stops it afterwards. Needs `pnpm db:up`: `e2e/admin.spec.ts` and `e2e/checkout.spec.ts` empty the `users` table and create their own admin, and every spec that reads the catalogue runs `pnpm seed` in `beforeAll`, so no spec relies on existing data. Orders accumulate across runs (they are never deleted); the checkout spec counts orders before and after, never absolute. |
| `pnpm build` | Regenerates Payload's import map, then `next build`. Needs `.env` but no running database. |
| `pnpm payload generate:types` | Regenerate `src/payload-types.ts` after a collection change |

Check set, in order: `git diff --check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.

## Ports

- 3000: `pnpm dev`.
- 3417: Playwright's server (`playwright.config.ts`), bound to `localhost`. It never reuses a running server, so a collision fails loudly. Do not bind dev servers with `--hostname 127.0.0.1`: Next builds `request.url` on `localhost`, next-intl's rewrites then look cross-origin and redirect-loop.
- 5437: Postgres, bound to 127.0.0.1 only. Ports 5432-5435 and 7784-7785 belong to other projects on this host; do not touch their containers.

## Postgres

- Start: `pnpm db:up` (`docker compose up -d --wait`). Container `xenia-dev-postgres`, data in the gitignored `.data/postgres`.
- Stop: `pnpm db:down`.
- Reset (dev data is disposable): `pnpm db:reset`.
- Schema management pre-launch: Payload's dev **push** (`@payloadcms/db-postgres` pushes the schema when `NODE_ENV` is not `production`). There is no `migrations/` directory. Reason: the schema changes every slice and dev data is disposable, so migrations would only record churn. The first deploy creates one baseline migration and switches to migrations from then on.

## Process rule

Every server and container a seat starts is stopped before it reports: dev servers by the pid it started, Postgres by `pnpm db:down`. Never stop a process or container you did not start.

## Pre-launch policy

One live contract and one implementation path. No compatibility layers, shims, aliases, dual paths, fallbacks for removed designs, or migrations for dev data. When the design changes, make the breaking change and update every caller and test.

## Age gate invariants (Decree 24/2020 Art. 6.1, Law 44/2019 Art. 16.3)

- The gate is `src/proxy.ts`, which runs on the server before any page renders. It redirects every storefront request without the marker cookie to `/xac-minh-tuoi` (or `/en/xac-minh-tuoi`) with the requested path in `next`, then hands everything else to next-intl's middleware.
- Exempt: `/xac-minh-tuoi`, `/tam-biet` and their `/en` equivalents, `/admin`, `/api` (Payload), `/_next` and `/_vercel`. Everything else is gated, including paths with a file extension. A new file in `public/` is gated unless its path is exempted in the proxy matcher.
- The form asks for a full name and a date of birth. A bare "I am 18+" button does not satisfy D4.
- Validation is on the server (`src/app/[locale]/xac-minh-tuoi/actions.ts`, `src/lib/age.ts`). Blank or whitespace-only name, unparseable date and future date of birth are field errors, not refusals.
- Adult: the visitor returns to the sanitised `next` path. Under 18: redirected to `/tam-biet` with no marker. There is no lockout.
- Age rule (`isAdult` in `src/lib/age.ts`): computed on the calendar date in `Asia/Ho_Chi_Minh`, never server-local or UTC. The 18th birthday is adult. A 29 February birthday reaches 18 on 1 March in a non-leap year.
- Return path (`src/lib/return-path.ts`): only same-origin relative paths. A missing or empty `next`, absolute URLs, `//host`, backslashes, control characters and `javascript:` become the home of the gate's locale: `/` for vi, `/en` for en.
- Privacy: the declared name and date of birth are never persisted — no database, log, cookie value or analytics. The marker cookie `xenia_age_ok=1` carries no personal data, is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and lasts for the browser session. A forged marker is an accepted residual (equal to a false self-declaration); do not add signing or eKYC.
- The notice `Không bán rượu, bia cho người chưa đủ 18 tuổi` (Law 44 Art. 32.5) is in the storefront layout footer on every page; `/en` shows an English translation beside it.

## Catalogue

- Collections in `src/collections/catalogue.ts`: `producers`, `wines`, `vintages`, localized vi (default) and en with `fallback: false`. Vocabularies (types, countries, occasions, pairings, bottle sizes) live in `src/lib/catalogue.ts`.
- Access: the catalogue collections set no `access`, so Payload's default applies and every operation over `/api` needs an authenticated admin. Do not add a public `read`: `/api` is exempt from the age gate, so a public read would hand product information to an undeclared visitor (Decree 24/2020 Art. 6.1, D4). The storefront reads through Payload's Local API on the server (`src/lib/catalogue-data.ts`). GraphQL has no route (`src/app/(payload)/api` has only the REST catch-all). `e2e/catalogue.spec.ts` checks unauthenticated REST and `/api/graphql` return no catalogue data.
- Published: a wine with `status: published` that has at least one `published` vintage. The collection page lists only those.
- ≥15° restriction (Law 44/2019 Art. 5.7 and 5.9): a vintage at 15% ABV or above may not be advertised or promoted. `isAdRestricted(abvPct)` in `src/lib/catalogue.ts` (`abvPct >= 15`, per vintage) is the only definition. It is derived on read and never stored: no column, no stored field, no seed value. The admin shows it as the read-only `adRestricted` virtual field on vintages (list column and edit view), computed by an `afterRead` hook.
- Every future promotional surface (banner, featured placement, sale price, discount, gift-with-purchase, free wrap) must exclude restricted vintages through `isAdRestricted`. A surface that promotes a whole wine treats it as restricted when any of its published vintages is. No such surface exists yet.
- Collection page `/ruou-vang`: facet and sort state is the URL query, applied on the server by the pure `listWines` in `src/lib/catalogue.ts`. Facets are plain links, so they work without client JS. Size and price band are vintage facets: a wine matches when one of its published vintages satisfies both, and the card's "from" price is the lowest price among the matching vintages.
- Collection cards link to the product page and carry an active `size` facet as `?size=`.
- Product page `/ruou-vang/<slug>` (and `/en/ruou-vang/<slug>`, same slug): rendered per request from `loadWine` in `src/lib/catalogue-data.ts` (Local API). A draft wine, an unknown slug and a published wine with no published vintage render the not-found page with HTTP 404.
- Selector query `?vintage=<year|nv>&size=<ml>`, resolved on the server by the pure `selectVintage` in `src/lib/vintage-selection.ts`, the one place that drops draft vintages. Options are plain links, so they work without client JS. Default: the most recent published vintage (years newest first, NV after every year) in 750 ml, or its smallest size when it has no 750 ml. An unknown or unavailable value never errors: an invalid `vintage` resolves to the most recent vintage that has the requested `size`, else the default vintage; a `size` the chosen vintage lacks resolves to that vintage's default size.
- The spec list shows, for the selected vintage: producer, vintage or NV, country, region, appellation (when set), grapes with shares, ABV as `% vol`, volume, drinking window (when set), importer, serving temperature, tasting note, the four-axis profile as text, pairings, price (VND, VAT included) and stock state. It shows no occasions, awards or promotional copy. Below the selector, an add-to-cart form (quantity, capped at stock) adds the selected vintage when it has stock.
- Price bands (integer VND, VAT included; lower bound inclusive, upper exclusive): under 1 000 000; 1 000 000 to under 2 000 000; 2 000 000 to under 4 000 000; 4 000 000 and over.
- Images are placeholders drawn in CSS. There is no `public/` directory.

## Cart, checkout and orders

- Routes: cart `/gio-hang`; checkout step 1 buyer `/thanh-toan`, step 2 delivery `/thanh-toan/giao-hang`, step 4 review and consent `/thanh-toan/xac-nhan` (step 3, the gift service, is S5); order status and mock payment `/don-hang/<token>`. All gated like every storefront route, same slugs under `/en`, rendered per request. A step with an empty cart redirects to the cart; a step without its earlier steps redirects to the first missing one.
- Cart: the `xenia_cart` cookie holds only vintage ids and quantities (`[{v, q}]`, at most 20 lines), never a price or personal data. `HttpOnly`, `SameSite=Lax`, `Secure` in production, browser session. Every read resolves it against the database with the pure `normalizeCart` (`src/lib/cart.ts`): unknown, draft (vintage or wine) and out-of-stock vintages are dropped and quantities capped at stock. Adding is allowed only for a published vintage of a published wine with stock.
- Checkout state between steps: the `xenia_checkout` cookie (same attributes) holds the idempotency key, the validated buyer (name, phone, email, residential address), `attestedAt` and the zone. It never holds the date of birth. It is re-validated on every read (`parseCheckout`) and cleared after placement. A forged `attestedAt` is the same accepted residual as a forged gate marker.
- Step 1 (Decree 24/2020 Art. 6.1): the server validates every field (`checkBuyer`, `src/lib/buyer.ts`) and re-checks age with `isAdult`. Under 18: no order, the marker and checkout cookies are deleted, redirect to `/tam-biet` (locale-aware). The date of birth is never stored: no column, log or cookie; the order keeps `ageAttestedAt` only.
- Step 2: delivery to the buyer only. Zones and flat fees live in the `site-settings` global (only a `zones` field; admin-only like the catalogue; the storefront reads it through the Local API). The step shows the courier ID-check rule (Decree 24/2020 Art. 6.3).
- Step 4 (Law 122 Art. 12): goods and quantities, the delivery method, the cashless payment methods, goods, shipping, total and the VAT included, an edit link to each earlier step, and two unticked required consents (terms, privacy). The consent links point at `/chinh-sach/dieu-khoan` and `/chinh-sach/bao-mat`, which are not found until the policy pages exist (S6).
- Totals: `computeTotals` in `src/lib/order-totals.ts` is the only arithmetic, in integer VND: goods = Σ qty × unit price; shipping = the zone fee; total = goods + shipping; VAT included = total × 10 / 110 rounded to the nearest whole VND (a tie cannot occur). Non-integer or negative inputs throw. The review and placement recompute on the server from stored prices and the fee; no posted or cookie price, fee or total is ever read.
- Placement (`placeOrder`, `src/lib/place-order.ts`): one server action, one database transaction through the Local API. Every line is re-read (published vintage and wine, stock), and the unit price, ABV and vi and en wine names are snapshotted. A missing, draft or over-stock line refuses the whole order with a per-line field error, and the cart is rewritten to what is available so the next review is accurate.
- Stock: decremented at placement, in the transaction, with an atomic `stock = stock - qty` in vintage-id order. The Postgres CHECK `vintages_stock_non_negative` (added in `payload.config.ts` `afterSchemaInit`) refuses a concurrent oversell. A failed mock payment keeps the stock reserved; the order stays `placed` and the buyer can retry. Restocking a cancelled order is an admin stock edit.
- Idempotency: the checkout state's key (a v4 UUID) is posted with the review form. Placement first returns any order with that `clientKey`; the unique index on `clientKey` makes a concurrent duplicate roll back and return the winner. Double submit, back-and-resubmit and a replayed POST all land on the one order.
- Status link: `/don-hang/<token>`, token = 32 bytes from the CSPRNG as base64url (43 characters), stored in a unique column for lookup, hidden in the admin, never logged by the app. A malformed or unknown token is a 404. The page is `noindex` and sets the `no-referrer` referrer policy.
- Order number: `XN-XXXX-XXXX`, 40 random bits in Crockford base32, unique column; a collision fails placement closed.
- Payment (Law 44/2019 Art. 16.4): mock only, no provider, key, webhook or network call. The method enum is exactly `vietqr_mock` and `card_mock`; there is no cash-on-delivery value anywhere. No card or bank account number is ever asked for. Success marks a `placed` order `paid`; failure records `payment.status = failed` and leaves the order `placed`.
- `orders` (Law 122 Art. 16.2b): default admin-only access; `create` is closed over REST and in the admin (placement is the only path); `delete` is closed and a `beforeDelete` hook refuses every delete, Local API included. The admin can change only `status` (placed, paid, packed, out_for_delivery, delivered, id_check_failed, cancelled, returned); every snapshot field has field-level `update: false`.

## Conventions

- All UI copy lives in `messages/vi.json` and `messages/en.json`. `src/i18n/messages.test.ts` fails on hardcoded JSX copy under `src/app/[locale]`.
- Mood B (ivory editorial): tokens in `src/app/globals.css`. Fonts are Cormorant Garamond (display) and Be Vietnam Pro (body), self-hosted from `@fontsource` packages; both carry the Vietnamese subset.
- No runtime request to any third-party origin (fonts, analytics, embeds). No images of people; no competitor content.
- Payload admin lives at `/admin` and is not behind the gate.
- The admin makes no third-party request either: `admin.avatar` is `"default"` (Payload's default is Gravatar). `e2e/admin.spec.ts` fails on any non-localhost http(s) request or ws(s) connection in create-first-user, dashboard, account, the catalogue lists, a vintage's edit view and login. Every third-party check uses `blockThirdParty` in `e2e/support.ts`, which watches both.
- Payload's code and JSON field editors load Monaco from `cdn.jsdelivr.net`, and Payload has no setting to self-host it. A slice that adds a `code` or `json` field must first make Monaco load without a third-party origin, or not use the field.
