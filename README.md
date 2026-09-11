# ⚽ Football Castellón — Admin

A lightweight web application for managing a football team: players, games, attendance, payments, season tickets, and finance.

The application is being migrated from Supabase/PostgreSQL to PHP + MariaDB on the `migration/mysql-php` branch. The frontend remains plain HTML, CSS, and JavaScript.

## MySQL migration

Target hosting stack:

- PHP 8.4
- MariaDB 11.x
- phpMyAdmin
- Plesk / Cloud86

The target schema is in `database/schema.sql`.

Do not put database passwords or OAuth secrets in the repository. Production credentials belong in server-side PHP configuration.

## Migration workflow

1. Import `database/schema.sql` into the empty MariaDB database.
2. Build and test the PHP API on this branch.
3. Replace Supabase frontend calls with the PHP API.
4. Replace Supabase Auth with Google OAuth + PHP sessions.
5. Test all roles and application features.
6. Deploy the migration branch to a test/production path.
7. Merge into `main` only after acceptance testing.

The migration is intended to preserve the existing players, games, Game Squad, payments, season tickets, finance, access control, member profiles, bib tracking, team selection and calendar functionality.
