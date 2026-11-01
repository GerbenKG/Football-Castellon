# Football Castellón

The app uses PHP 8.4 and MariaDB 11 on Cloud86/Plesk. phpMyAdmin is the database
administration tool. The browser talks only to the PHP API on the same domain;
database credentials are never sent to browser code.

## Test locally on Windows

PHP and XAMPP/MariaDB are installed on this computer. From the project folder:

```powershell
.\dev\start.ps1
```

Open http://localhost:3001/ and click Continue with Google. In local mode this
opens a **sample-account chooser**, not real Google. Choose Super Admin first;
switch to Player, Finance, Attendance, Admin or Viewer to test permissions.
Use the LOCAL TEST banner to switch accounts.

The launcher creates a separate loopback-only MariaDB instance on port 33079
and a sample database named football_castellon_dev. It never connects to Cloud86.
The local credentials, database files, process records and logs stay in the
ignored .local/ folder. Restarting preserves your sample edits.

To stop both local processes:

```powershell
.\dev\stop.ps1
```

Port 3000 can keep serving an older static preview; use **3001** for this app.
Real Google OAuth must be tested separately on a configured PHP host. The local
account chooser requires the PHP built-in server, an explicit launcher flag,
a loopback connection and a localhost Host header. It cannot run under Plesk's
PHP handler. Production keeps its secure session cookies and real Google login.

On another Windows machine, pass -PhpPath and -DatabaseBin if the tools are in
different folders. The application still targets PHP 8.4/MariaDB 11 in production;
the installed local XAMPP server is MariaDB 10.4 and does not replace staging tests.

## Deploy

Deploy the complete branch, including api/, to the PHP-enabled document root
serving castellon.futbol. Static hosting cannot run this backend.

Keep these configuration files one directory ABOVE the document root. Reuse the
existing server configuration; do not put secrets into Git.

db-config.php must return an array with host, port, database, username and password.
The observed production database is football_Castellon_ on localhost:3306.
Use the database account configured in Plesk.

google-config.php must return client_id and client_secret for the existing Google
OAuth application. Register this exact authorized redirect URI:

```text
https://castellon.futbol/api/auth/google-callback.php
```

PHP needs pdo_mysql, curl, fileinfo and session support. HTTPS is required for
the secure session cookie. Profile pictures are stored in football-avatars/
beside the document root. The PHP account needs permission to create that folder.

## Existing database

The API targets the twelve tables inspected in the existing MariaDB database:
access_profiles, finance_expenses, finance_seasons, finance_season_tickets, games,
game_players, payments, players, role_permissions, sessions, team_captain_history,
and users.

No schema import or table reset is needed. Existing access_profiles invitations,
Google account links and session records are reused. Only invited, active accounts
can sign in. Super Admin access is fixed; other permissions come from
role_permissions. Member previews are read-only.

The API validates table names, columns, filters and permissions on the server.
Writes require the session-bound CSRF token. Payment permission is separate from
attendance permission. Game payments use game_players.paid, and season tickets use
finance_season_tickets. Ordinary saves never delete unrelated rows.

## Verification

```sh
node tests/frontend.test.cjs
node tests/php-client.test.cjs
php tests/query.test.php
php tests/security.test.php
php tests/data-security.test.php finance-paid
php tests/data-security.test.php finance-squad-edit
php tests/data-security.test.php attendance-paid
php tests/data-security.test.php empty-delete
php tests/data-security.test.php viewer-paid
```

Also lint all PHP files before deployment. These tests use fixtures and do not
connect to the production database. After deploying to a staging PHP host, test
Google sign-in/sign-out, rejected accounts, each role, roster changes, signup and
withdrawal, team selection, bibs, finance, member previews and avatar uploads.

GET /api/health.php checks database connectivity without revealing configuration.
The app has no build step and makes no requests to an external database service.
## Live-data testing on the development site

The existing Plesk site dev.castellon.futbol uses db-config.dev.php one directory
above its document root. Production continues to use db-config.php. Both files
can connect to the same live database; changes in the dev site then affect real data.
Do not run dev/setup.php against the live database or copy .local/ to the server.

Before testing:

1. Add a DNS A record for dev.castellon.futbol pointing to 45.82.191.137.
2. Make sure Plesk has a valid HTTPS certificate for dev.castellon.futbol.
3. Register https://dev.castellon.futbol/api/auth/google-callback.php as an additional
   authorized redirect URI in the existing Google OAuth client.
4. Pull and deploy fix/php-mysql-from-main to the DEVELOPMENT site's document root.
5. Verify /api/health.php and sign in with an invited account.

The production domain retains its own Google callback. Callback selection is
restricted to the known production and development hostnames, unless an explicit
same-host HTTPS callback is added to redirect_uris in google-config.php.
Both hosts use separate host-only session cookies. No sample login is enabled
under Plesk: local test login requires the isolated built-in development server.

Development database credentials stay only in the private server-side db-config.dev.php file. This file is excluded from Git. Production configuration and deployment are independent.

## Clubhouse redesign (development branch)

`index.html` is the player-facing clubhouse. `office.html` retains the existing
management tools for authorised board members, with links back to the clubhouse.
The redesign lives on `feature/clubhouse-dev`; deploy this branch only to
`dev.castellon.futbol`. Production and main are not changed.

The authenticated club API adds two tables, `club_records` and `club_audit`, with
CREATE TABLE IF NOT EXISTS. It never resets existing tables. These hold club
announcements, published teams/results/goals, player preferences, one vote per
member per match, waiting lists and transfer reports. Existing records remain
the source of truth for fixtures, playing lists, tickets, payments and expenses.
Database credentials still live outside the document root.

Shared squad pages exclude emails, phone numbers, payment flags and skill levels.
Individual payment reports are visible only to their owner and finance roles.
Every mutation requires a session-bound CSRF token and server-side permission
checks. Financial changes through both the clubhouse and older management tools
are recorded in the audit history; this starts at deployment, not retroactively.

Capacity is optional. Once full, a match queues additional signups. A withdrawal
or capacity increase automatically admits the first waiting player; there is no
email/push delivery or acceptance deadline. Board squad overrides remain possible.
Players should check their status before kick-off. Published line-ups are a
reviewable random draft with manual adjustments, not a skill-based ranking.

A transfer report does not clear a balance: a treasurer must confirm receipt.
The displayed club balance is recorded income minus paid expenses, not a bank
reconciliation. The app never initiates bank transfers. Withdrawals retain paid
flags but are not an automated refund/credit system; the treasurer handles these.

Statistics use the playing lists of completed matches with at least one recorded
participant. They exclude future fixtures. Goals and W/D/L require recorded
results; W/D/L additionally requires published teams. Historical signups are
labelled recorded appearances rather than verified attendance. No results,
photos or milestones are invented. Times and calendar files use Europe/Madrid.

Data refreshes after saves and every 60 seconds while the page is visible and
no form is being edited. This is polling, not a WebSocket subscription.

Additional checks (isolated sample database only):

```
node tests/club-model.test.cjs
node tests/club-local.test.cjs
```

The integration server for the second command must be the local PHP server on
port 3002 with FOOTBALL_LOCAL_DEV=1 and the isolated sample database. Its local
login page is checked before any fixture is created. Never point these tests at
the live database. Receipts, match-photo uploads, notifications and birthdays are
not part of this release; existing member profile-picture support is retained.

## Unified management design and page permissions

The board tools now load the same `club.css` design system as the clubhouse,
with a shared sidebar, crest, page spacing, typography, form controls, and mobile
navigation. `office-theme.css` styles the existing financial tables, calendars,
roster controls and dialogs. No fixture or payment data is rewritten for styling.

Club owners manage access at `office.html?view=admin`:

- Link an invited Google account to an existing player and assign its profile.
- Edit access directly from a player record, or search/filter the member list.
- Set each profile's pages to No access, Read only, or Can edit, then explicitly save.
- Disable an account without deleting historical player or payment records.

The existing role identifiers are retained: super_admin (Club owner), admin
(Club board), attendance (Match organiser), finance (Treasurer), viewer (Read-only
member), and player (Player). Profile names are descriptions; the saved page
settings determine the actual permissions. Club owners have fixed full access;
only Club owners can change membership or permissions. Self-demotion or disabling
one's own owner account is rejected on the server.

New clubhouse.view, clubhouse.manage and squad.view permission rows are seeded
with INSERT IGNORE to retain the redesign's current audience and editors. Existing
saved role permissions and player/profile assignments are not reset. Thereafter,
profile changes are transactional, validated on the server and audited. Private
player records and other members' finances have separate access settings. Match
squad reads omit payment flags without finance read access. All members retain
access to their own My Club details and personal payments.

Role/profile integration tests create temporary fixtures only in the isolated
local database, then restore the changed sample profiles and account assignment.
Additional checks: `node tests/access-model.test.cjs` and `php tests/access.test.php`.

## Owner-only member preview

Club owners can select **Log in as** next to an active member, or from the member's
player record. This opens that person's clubhouse, My Club details, bookings,
season tickets, payment history and permitted board tools in a read-only preview.
A fixed banner identifies the selected person and offers **Exit preview**.

The owner keeps their original application session. Preview context is attached
per tab/request using an opaque member key; no member login is performed, no
session is created for the selected member, and no profile assignment is changed.
Every API read resolves the target's current role and player identity after
verifying that the actual signed-in account is still a Club owner. Disabled or
missing members cannot be previewed. Invited members can be previewed before
their first Google sign-in.

Writes are rejected in the API's shared session bootstrap whenever preview
context is present, including payment, signup, avatar, membership and logout
requests. The browser also disables editing controls and blocks mutation calls.
Preview context follows navigation between the clubhouse and board tools. Exit
preview returns to the owner's member list without signing anyone out. A normal
owner tab continues to work independently.

Checks: `node tests/preview-client.test.cjs`, `php tests/preview.test.php`, and the
expanded local integration suite. These use only mock data or the isolated sample
database; never run write-oriented integration tests against the live database.
