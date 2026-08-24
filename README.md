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
