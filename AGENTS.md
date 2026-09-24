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
| `pnpm seed` | Replaces the catalogue (producers, wines, vintages) with the fictional seed in `src/seed/data.ts`. Deterministic content; never touches `users` or any other collection. Needs `pnpm db:up`. |
| `pnpm test:e2e` | Playwright + axe. Starts its own `next dev` on **localhost:3417** and stops it afterwards. Needs `pnpm db:up`: `e2e/admin.spec.ts` empties the `users` table and creates its own admin, and the admin and catalogue specs run `pnpm seed` in `beforeAll`, so no spec relies on existing data. |
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
- `ad_restricted` (ABV ≥ 15) is derived from `vintages.abvPct` wherever it is needed, and is never stored.
- Collection page `/ruou-vang`: facet and sort state is the URL query, applied on the server by the pure `listWines` in `src/lib/catalogue.ts`. Facets are plain links, so they work without client JS. Size and price band are vintage facets: a wine matches when one of its published vintages satisfies both, and the card's "from" price is the lowest price among the matching vintages.
- Price bands (integer VND, VAT included; lower bound inclusive, upper exclusive): under 1 000 000; 1 000 000 to under 2 000 000; 2 000 000 to under 4 000 000; 4 000 000 and over.
- Images are placeholders drawn in CSS. There is no `public/` directory.

## Conventions

- All UI copy lives in `messages/vi.json` and `messages/en.json`. `src/i18n/messages.test.ts` fails on hardcoded JSX copy under `src/app/[locale]`.
- Mood B (ivory editorial): tokens in `src/app/globals.css`. Fonts are Cormorant Garamond (display) and Be Vietnam Pro (body), self-hosted from `@fontsource` packages; both carry the Vietnamese subset.
- No runtime request to any third-party origin (fonts, analytics, embeds). No images of people; no competitor content.
- Payload admin lives at `/admin` and is not behind the gate.
- The admin makes no third-party request either: `admin.avatar` is `"default"` (Payload's default is Gravatar). `e2e/admin.spec.ts` fails on any non-localhost http(s) request or ws(s) connection in create-first-user, dashboard, account, the catalogue lists and login. Every third-party check uses `blockThirdParty` in `e2e/support.ts`, which watches both.
- Payload's code and JSON field editors load Monaco from `cdn.jsdelivr.net`, and Payload has no setting to self-host it. A slice that adds a `code` or `json` field must first make Monaco load without a third-party origin, or not use the field.
