const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("birthday is stored as month and day only and added to the shared club snapshot", () => {
  const lib = read("api/club-lib.php");
  const api = read("api/club.php");
  const schema = read("dev/schema.sql");
  assert.match(lib, /birthday_month TINYINT UNSIGNED NULL/);
  assert.match(lib, /birthday_day TINYINT UNSIGNED NULL/);
  assert.match(lib, /p\.birthday_month,p\.birthday_day/);
  assert.match(api, /case 'player_birthday'/);
  assert.match(api, /checkdate\(\$month, \$day, 2000\)/);
  assert.match(schema, /birthday_month TINYINT UNSIGNED NULL/);
  assert.match(schema, /birthday_day TINYINT UNSIGNED NULL/);
});

test("members can edit their birthday and clubhouse lists the next five", () => {
  const ui = read("club.js");
  assert.match(ui, /Birthday month/);
  assert.match(ui, /Birthday day/);
  assert.match(ui, /action:'player_birthday'/);
  assert.match(ui, /slice\(0,5\)/);
  assert.match(ui, /Upcoming birthdays/);
  assert.match(ui, /Your birthday will appear to club members/);
});
