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

The existing Plesk site dev.castellon.futbol can run this branch with the same
server-side database configuration as production. Changes there affect real data.
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
