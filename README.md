# ⚽ Football Castellón — Admin

A lightweight web application for managing a football team: players, games, attendance, payments, season tickets, and finance.

The application is being migrated from Supabase/PostgreSQL to PHP + MariaDB on the `migration/mysql-php` branch. The frontend remains plain HTML, CSS, and JavaScript.

## MySQL migration

Target hosting stack:

- PHP 8.4
- MariaDB 11.x
- phpMyAdmin
- Plesk / Cloud86
- Domain/DNS managed separately

The target schema is in `database/schema.sql`.

Do not put database passwords or OAuth secrets in the repository. Production credentials belong in the server-side PHP configuration/environment.

## Current source-of-truth rules

- Player details: `players`
- Game Squad / attendance: `game_players`
- Pay-per-game payment state: `game_players.paid`
- Season-ticket ownership/payment: `finance_season_tickets`
- Game → season: match `games.game_date` against `finance_seasons.starts_on` and `finance_seasons.ends_on`
- Team captain history: `team_captain_history`
- Authentication identity: `users`
- Application access: `access_profiles`
- Role permissions: `role_permissions`

The migration deliberately does not reintroduce the removed player payment fields.

## Migration workflow

1. Import `database/schema.sql` into the empty MariaDB database.
2. Build and test the PHP API on this branch.
3. Replace Supabase frontend calls with the PHP API.
4. Replace Supabase Auth with Google OAuth + PHP sessions.
5. Test all roles and application features.
6. Deploy the migration branch to a test/production path.
7. Merge into `main` only after acceptance testing.

## Existing application

The application currently manages:

- Players and archived players
- Games and Game Squad
- Player sign-up
- Guests
- Payments
- Season tickets
- Finance and expenses
- Automatic team/captain selection
- Bib tracking
- Player/member access
- Member profiles
- Google Calendar links

The migration should preserve this behaviour while moving the backend away from Supabase.
