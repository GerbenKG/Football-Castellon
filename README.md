# ⚽ Football Castellón — Admin

A lightweight web application for managing a football team: players, games, attendance, payments, season tickets, and finance.

The application is deliberately small and practical. Supabase provides authentication, PostgreSQL data storage, and access control; the frontend is plain HTML, CSS, and JavaScript.

## Features

### Players

The player roster stores:

- Name
- Phone number
- Email address

Payment type and season-ticket status are **not** stored on `players`.

### Games & Game Squad

Games contain a date, start/end time, location, and Game Squad. Squad records can track:

- Playing / not playing
- Attendance
- Pay-per-game payment
- Season-ticket status

### Season tickets

Season tickets are managed in Finance.

**`finance_season_tickets` is the single source of truth for season-ticket ownership and payment status.**

A season-ticket record is linked to:

- a player via `player_id`
- a season via `season_id`
- the ticket amount
- `paid` status

When the application needs to determine whether a player has a season ticket for a game, it resolves the game's date to the relevant `finance_seasons` record and checks `finance_season_tickets` for that player and season.

### Finance

Finance provides:

- Season management
- Season-ticket holders
- Season-ticket payment tracking
- Pay-per-game payment tracking
- Expenses / pitch costs
- Outstanding payments
- Financial summaries

The selected season is the context for season-ticket information on the Finance page.

## Data model

| Table | Purpose |
|---|---|
| `players` | Player names and contact details |
| `games` | Game schedule and location |
| `game_players` | Game Squad membership, attendance and game payment state |
| `finance_seasons` | Season definitions and financial settings |
| `finance_season_tickets` | Season-ticket ownership, amount and payment status |
| `payments` | Payment records |
| `expenses` | Finance expenses |

### Source-of-truth rules

- **Player details:** `players`
- **Game Squad / attendance:** `game_players`
- **Pay-per-game payment:** `game_players.paid`
- **Season-ticket ownership:** `finance_season_tickets`
- **Season-ticket payment:** `finance_season_tickets.paid`
- **Season-ticket count:** `finance_season_tickets`
- **Game → season:** match `games.game_date` against `finance_seasons.starts_on` and `finance_seasons.ends_on`

There is intentionally no dependency on the removed `players.model` or `players.season_paid` fields.

## Technology

- HTML / CSS / vanilla JavaScript
- Supabase
- PostgreSQL
- Supabase Auth
- Static hosting

There is no frontend build framework or bundling step.

## Repository structure

Key application files:

- `index.html` — application shell and asset loading
- `app.js` — main application logic and rendering
- `style.css` — primary styling
- `dashboard-stats.css` — Dashboard statistics styling
- `finance-mobile.css` — Finance responsive styling
- `mobile-nav.css` — mobile navigation styling
- `supabase-config.js` — Supabase client configuration
- `finance-season-tickets.js` — season-ticket functionality
- `finance-season-rules.js` — finance/season rules
- `players-ui-fix.js` — player UI behaviour
- `signup-payment-rules.js` — signup/payment rules
- `ui-fixes.js` — shared UI behaviour
- `supabase/migrations/` — version-controlled database migrations

One-off SQL import/setup scripts are intentionally not retained after execution. Schema migrations remain under `supabase/migrations/` so database changes stay reproducible.

## Local development

This is a static application. Serve it through a local HTTP server rather than opening `index.html` directly.

### 1. Clone the repository

```bash
git clone https://github.com/GerbenKG/Football-Castellon.git
cd Football-Castellon
```

### 2. Switch to the branch you want to test

For example:

```bash
git checkout feature/player-access
```

To get the latest commits on that branch later:

```bash
git pull
```

### 3. Start the local server

The easiest option on Windows for this repository is:

```bash
npx serve .
```

The first run may ask for permission to install the `serve` package. Confirm with `y`.

The terminal will show a local address such as:

```text
Local: http://localhost:3000
```

### 4. Open the application

Open:

```text
http://localhost:3000
```

Keep the terminal window running while testing. Stop the server with:

```text
Ctrl+C
```

### Authentication

The application uses Supabase Auth. The local site runs against the Supabase project configured in `supabase-config.js`, so the required Supabase authentication and database configuration must already be available. A local browser session may need to sign in again.

## Database changes

Schema changes should be implemented as Supabase migrations under:

```text
supabase/migrations/
```

Do not reintroduce removed player payment fields or create a second source of truth for season tickets.

For one-time data imports, run the SQL directly against the Supabase project rather than committing temporary import scripts to the application repository.

## Access control

The application uses role-based access control through Supabase. Current roles include:

- Super Admin
- Admin
- Attendance
- Finance
- Viewer
- Player

Permissions determine which areas users can view or modify. Access should be managed through **Admin & Access**, not hard-coded in the frontend.

## Development principles

1. **Use the current database model as the source of truth.** Do not reintroduce `players.model` or `players.season_paid`.
2. **Keep season-ticket logic in Finance.** A season ticket exists because a row exists in `finance_season_tickets`.
3. **Resolve a game's season from its date.** Do not use the current date when displaying historical or future game information.
4. **Keep payment types separate.** `game_players.paid` is for pay-per-game payments; `finance_season_tickets.paid` is for season-ticket payments.
5. **Integrate functionality into the real renderer.** Avoid temporary DOM patches and duplicate override scripts.
6. **Keep schema changes reproducible.** Commit database migrations under `supabase/migrations/`.

## Development workflow

The primary development workflow is local:

**edit → commit to a branch → `git pull` locally → run `npx serve .` → test at `http://localhost:3000`**

No deployment step is required to test frontend changes locally.

## Current status

This is an internal football administration tool focused on a straightforward operational workflow:

**maintain players → schedule games → manage the Game Squad → record attendance/payments → manage season tickets → monitor finance.**
