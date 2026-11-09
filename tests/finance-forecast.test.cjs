const test = require("node:test");
const assert = require("node:assert/strict");
const ClubModel = require("../club-model");

test("finance forecast averages pay-per-game attendance, including guests, and projects remaining fixtures", () => {
  const now = "2026-11-09T12:00:00";
  const data = {
    games: [
      { id: "g1", game_date: "2026-10-01", start_time: "19:00:00", end_time: "20:00:00" },
      { id: "g2", game_date: "2026-10-08", start_time: "19:00:00", end_time: "20:00:00" },
      { id: "g3", game_date: "2026-10-15", start_time: "19:00:00", end_time: "20:00:00" },
      { id: "g4", game_date: "2026-11-12", start_time: "19:00:00", end_time: "20:00:00" },
      { id: "g5", game_date: "2026-11-19", start_time: "19:00:00", end_time: "20:00:00" }
    ],
    signups: [
      { id: "r1", game_id: "g1", player_id: "season-ticket-player" },
      { id: "r2", game_id: "g1", player_id: "payg-player-1" },
      { id: "r3", game_id: "g1", player_id: null, guest_name: "Guest One" },
      { id: "r4", game_id: "g2", player_id: "payg-player-2" },
      { id: "r5", game_id: "g2", player_id: null, guest_name: "Guest Two" }
    ]
  };
  const finance = {
    season: {
      starts_on: "2026-09-01",
      ends_on: "2027-06-30",
      pay_per_game_amount: 5
    },
    tickets: [{ player_id: "season-ticket-player" }],
    due: [{ amount: 5 }],
    expenses: [{ amount: 3, paid: false }],
    balance: 20
  };

  const forecast = ClubModel.financeForecast(finance, data, now);

  assert.equal(forecast.completedGames, 3);
  assert.equal(forecast.remainingGames, 2);
  assert.equal(forecast.payPerGameAppearances, 4);
  assert.equal(forecast.averagePlayersPerGame, 4 / 3);
  assert.equal(forecast.projectedFutureIncome, 13.33);
  assert.equal(forecast.openFees, 5);
  assert.equal(forecast.predictedOpenFees, 18.33);
  assert.equal(forecast.unpaidExpenses, 3);
  assert.equal(forecast.seasonEnd, 35.33);
});

test("finance forecast returns zero projected income when no completed games exist", () => {
  const forecast = ClubModel.financeForecast({
    season: { starts_on: "2026-09-01", ends_on: "2027-06-30", pay_per_game_amount: 6 },
    tickets: [],
    due: [],
    expenses: [],
    balance: 0
  }, {
    games: [{ id: "future", game_date: "2026-11-12", start_time: "19:00:00", end_time: "20:00:00" }],
    signups: [{ id: "guest", game_id: "future", player_id: null }]
  }, "2026-11-09T12:00:00");

  assert.equal(forecast.completedGames, 0);
  assert.equal(forecast.averagePlayersPerGame, 0);
  assert.equal(forecast.projectedFutureIncome, 0);
  assert.equal(forecast.predictedOpenFees, 0);
});
