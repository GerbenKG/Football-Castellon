const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

test("Players bib column reads the persisted Players counter", async () => {
  const calls = [];
  const cells = [];
  const header = { lastElementChild: {}, insertBefore(node) { this.inserted = node; } };
  const row = {
    lastElementChild: {},
    querySelector(selector) { return selector === '[data-a="edit"]' ? { dataset: { id: "player-1" } } : null; },
    insertBefore(node) { cells.push(node); }
  };
  const table = {
    querySelector(selector) {
      if (selector === 'th[data-bibs-count-column]') return null;
      if (selector === "thead tr") return header;
      return null;
    },
    querySelectorAll(selector) { return selector === "tbody tr" ? [row] : []; }
  };
  const client = {
    from(name) {
      return {
        select(columns) {
          calls.push({ table: name, columns });
          return Promise.resolve({
            data: [{ id: "player-1", bibs_taken_count: 7 }, { id: "player-2", bibs_taken_count: 2 }],
            error: null
          });
        }
      };
    }
  };
  const context = vm.createContext({
    window: { footballClient: client },
    document: {
      querySelector(selector) {
        if (selector === '.nav-item.active[data-view="players"]') return {};
        if (selector === '.page-head + .table-card table') return table;
        return null;
      },
      createElement() { return { dataset: {}, textContent: "" }; },
      getElementById() { return {}; }
    },
    MutationObserver: class { observe() {} },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout() { return 1; },
    console
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "player-bibs-count.js"), "utf8");
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [{ table: "players", columns: "id,bibs_taken_count" }]);
  assert.equal(cells.length, 1);
  assert.equal(cells[0].textContent, "7");
  assert.equal(header.inserted.textContent, "Bibs taken");
});
