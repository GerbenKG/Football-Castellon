# Football Castellón — Admin

A simple admin site for Friday evening football.

## MVP

- Manage one roster of regular players.
- Mark players as **Season Ticket** or **Pay per game**.
- Record a season-ticket payment once for the season.
- Create Friday games.
- Add regular players or guests to a Friday.
- Track **Playing**, **Present**, and **Payment**.
- Per-game payment is tracked only when a player actually attends.
- Keep a separate attendance/payment record for every Friday.
- Guest players belong to the individual Friday rather than the permanent roster.
- Persist MVP data in the browser with localStorage.

## Run

This is a zero-build static site. Open `index.html` directly or publish the repository with GitHub Pages.

Sample data is included so the workflow is visible immediately.

## Next step for shared use

For multiple admins using different devices, replace localStorage with a small hosted database and add admin authentication. The current UI is deliberately designed so that migration can happen without changing the core workflow.