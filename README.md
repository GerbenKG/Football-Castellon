# Football Castellón — MySQL migration

This branch migrates the application backend from Supabase/PostgreSQL to PHP + MariaDB.

Target stack: PHP 8.4, MariaDB 11.x, phpMyAdmin and Plesk/Cloud86.

The target database schema is `database/schema.sql`.

Migration sequence:
1. Import the schema into the empty MariaDB database.
2. Build the server-side PHP API.
3. Replace frontend Supabase calls with API calls.
4. Replace Supabase Auth with Google OAuth and PHP sessions.
5. Test all application roles and features.
6. Deploy and acceptance-test before merging into `main`.

Never commit database passwords, OAuth client secrets, or session secrets.
