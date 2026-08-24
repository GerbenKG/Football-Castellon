# ⚽ Football Castellón — Admin

A lightweight admin website for managing our football.

The site is intentionally simple: **admins manage the players and games**. Players do not register themselves.

## What it manages

### Players

Admins can create and maintain the regular player roster.

Each player has:
- Name
- Active / inactive status
- **Season Ticket** or **Pay per game** payment model
- Season Ticket payment status

### Games

Each game is a separate game record.

For every game, admins can:
- Create the game
- Add regular players
- Add guest players
- Mark who is **Playing**
- Mark who was **Present**
- Track payment

### Payments

The payment rules are deliberately simple:

**Season Ticket**
- Payment is made once for the season.
- The player's season payment status is shown on every game.
- Attendance does not create another payment obligation.

**Pay per game**
- Payment is tracked separately for every game.
- Payment only matters when the player actually attended.

**Guests**
- Guests are attached directly to the game they played.
- Their payment is tracked for that game only.
- Guests do not need to be added to the permanent player roster.


## Authentication and access control

The site uses **Supabase Auth with Google Login**.

Access is allow-list based:
- A Google account must be added by a Super Admin before it can enter the site.
- The first authenticated account is automatically provisioned as **Super Admin** when the access list is empty.
- Super Admins can add/remove members, enable/disable access, assign profiles and change profile permissions from **Admin & Access** in the site.

Built-in profiles:
- **Super Admin** — full access, including access management.
- **Admin** — full football administration, but no access-management controls.
- **Attendance** — can view players/games and manage game attendance and guests.
- **Finance** — can view players/games and manage payment records.
- **Viewer** — read-only access.

The permission model is enforced twice:
1. The UI hides actions the profile cannot use.
2. Supabase Row Level Security enforces the same permissions at database level.

### Enabling the RBAC database

Run 'supabase-rbac.sql' once in the Supabase SQL Editor. This creates the access profiles, role permissions, secure RPCs and permission-based RLS policies.

Do not use the deprecated 'supabase-rls.sql' setup.

## Data storage

Player, game, attendance and payment data is stored in the project's **Supabase Postgres database**, not browser localStorage.

The static site is served from GitHub Pages. Supabase provides the authentication and database/API layer.

## Current MVP

The project is a zero-build static web application:
- 'index.html' — application shell
- 'style.css' — responsive UI
- 'app.js' — application logic, authentication and RBAC
- 'supabase-config.js' — Supabase project configuration
- 'supabase-rbac.sql' — database security and role configuration
- 'README.md' — project documentation


## Finance

The Finance page tracks the football season on a **September–August** basis.

For each season you can configure:
- Season-ticket price
- Pay-per-game price
- Season-ticket purchases by player
- Scheduled pitch-rental expenses
- Paid/unpaid status

The Finance dashboard shows:
- Current balance
- Outstanding payments
- Pitch-rental commitments
- Projected future game income based on recorded attendance
- Projected end-of-season balance

Run `supabase-finance.sql` once in the Supabase SQL Editor to create the finance tables and seed the 2026/27 pitch-rental schedule.
