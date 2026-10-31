# PHP/MySQL work from main

This branch is based on main at 58a138a. The production target is PHP with a
MySQL/MariaDB database managed through phpMyAdmin in Cloud86/Plesk.

## Completed frontend fixes

- Save only changed fields; delete records only for an explicit user action.
- Store game payment changes in game_players.paid for finance-only users too.
- Keep attendance edits separate from payment edits.
- Resolve pay-per-game classification from season tickets rather than players.model.
- Preserve individual ticket amounts when changing payment status.
- Restrict forecast attendance to past games in the selected season.
- Generate teams from players whose playing flag is true.
- Skip signed-out payment badge requests and avoid unchanged-count refresh loops.

Run the database-free regression tests with Node.js:

```sh
node tests/frontend.test.cjs
```

## Backend integration remains pending

The frontend inherited from main still loads the old Supabase client and calls
its interface. The frontend fixes do not complete the PHP/MySQL migration.
Do not deploy this branch as a replacement for the current PHP site yet.

The current production structure-only SQL export and deployed PHP API files are
needed to replace that interface without guessing table layouts, authorization
rules, or authentication contracts. Do not include credentials or production
records in those inputs. The existing local untracked api files are preserved
but are not part of this commit.

No production database changes or Supabase provisioning are required to review
these frontend fixes.
