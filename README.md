# ⚽ Football Castellón — Admin

A lightweight admin website for managing our Friday evening football.

The site is intentionally simple: **admins manage the players and games**. Players do not register themselves.

## What it manages

### Players

Admins can create and maintain the regular player roster.

Each player has:
- Name
- Active / inactive status
- **Season Ticket** or **Pay per game** payment model
- Season Ticket payment status

### Friday games

Each Friday is a separate game record.

For every game, admins can:
- Create the Friday
- Add regular players
- Add guest players
- Mark who is **Playing**
- Mark who was **Present**
- Track payment

### Payments

The payment rules are deliberately simple:

**Season Ticket**
- Payment is made once for the season.
- The player's season payment status is shown on every Friday.
- Attendance does not create another payment obligation.

**Pay per game**
- Payment is tracked separately for every game.
- Payment only matters when the player actually attended.

**Guests**
- Guests are attached directly to the Friday they played.
- Their payment is tracked for that game only.
- Guests do not need to be added to the permanent player roster.

## Current MVP

The current version is a zero-build static web application:
- `index.html` — application shell
- `style.css` — responsive UI
- `app.js` — application logic and data model
- `README.md` — project documentation

Data is currently stored in **browser localStorage**.

This makes the MVP easy to run and test without a backend.

> **Important:** localStorage is device/browser-specific. Two admins using different devices will not share the same data.

## Running locally

No Node.js, package manager, or build step is required.

Simply open `index.html` in a modern browser.

The application includes sample data so the main workflow can be tested immediately.

## Publishing with GitHub Pages

The site can be published as a static GitHub Pages site.

In GitHub:
1. Open **Settings** for the repository.
2. Open **Pages**.
3. Select **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`.
5. Save.

GitHub will then provide the public site URL.

## Data model

The MVP is based around four concepts:

```text
Player
  ├── payment model
  └── season payment status

Game
  ├── date
  ├── time
  ├── location
  └── participants

Game Participant
  ├── regular player OR guest
  ├── playing
  ├── attended
  └── paid
```

This keeps the payment logic separate from the player roster and allows every Friday to maintain its own attendance record.

## Roadmap

The next logical version should add a shared backend so all admins see the same data.

Recommended next steps:
1. **Shared database** — replace localStorage with a hosted database.
2. **Admin authentication** — restrict the site to football admins.
3. **Season management** — define seasons and attach Season Tickets to a specific season.
4. **Better game workflow** — automatically create recurring Friday games.
5. **Financial overview** — show outstanding payments and simple weekly/monthly totals.

The current UI is deliberately kept small so these capabilities can be added without changing the core workflow.