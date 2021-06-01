let count = 0, countFailed = 0,
    dynamicOnly = false, exitAfter = false,
    resolve = null;
export const root = newNode(),
             updateFixtures = window.args?.includes("update-fixtures"),
             fixtures = {},
             done = new Promise((r) => resolve = r);
export let current = {node: root};

export function t(name, f) {
  beforeCreate("t", name, f);
  current.node.children.push({name, f, selected: current.node.selected});
}

Object.assign(t, {
  describe(name, f) {
    beforeCreate("t.describe", name, f);
    group(name, f);
  },

  describeOnly(name, f) {
    beforeCreate("t.describeOnly", name, f);
    group(name, f, true);
    markNodes(current.node, "hasSelected");
    if (count || countFailed) dynamicOnly = true;
  },

  only(name, f) {
    beforeCreate("t.only", name, f);
    current.node.children.push({name, f, selected: true});
    markNodes(current.node, "hasSelected");
    if (count || countFailed) dynamicOnly = true;
  },

  exitAfter() {
    exitAfter = true;
  },

  beforeEach(name, f) {
    wrapper(name, f, "beforeEach");
  },

  afterEach(name, f) {
    wrapper(name, f, "afterEach");
  },

  before(name, f) {
    wrapper(name, f, "before");
  },

  after(name, f) {
    wrapper(name, f, "after");
  },

  throws(f, regexp, msg) {
    throws(f, regexp, msg, true);
  },

  rejects(f, regexp, msg) {
    return throws(f, regexp, msg);
  },

  assert(x, msg) {
    if (!x) t.fail(msg, `${x} == true`);
  },

  equal(x, y, msg) {
    if (x !== y) t.fail(msg, `${x} === ${y}`);
  },

  jsonEqual(x, y, msg) {
    x = json(x), y = json(y);
    if (x !== y) t.fail(msg, `${x} !== ${y}`);
  },

  assertFixture(actual, msg) {
    const {fixtures, updateFixtures, current} = window.test;
    if (!updateFixtures) t.jsonEqual(actual, fixtures[current.node.fixtureUrl][current.id]);
    else {
      fixtures[current.node.fixtureUrl] = fixtures[current.node.fixtureUrl] || {};
      if (fixtures[current.node.fixtureUrl][current.id]) t.fail(`reassignment of fixture "${current.id}"`);
      fixtures[current.node.fixtureUrl][current.id] = actual;
    }
  },

  bench(name, f, maxDuration = 1000) {
    current.node.children.push({name, f: f && (() => {
      let ts = [maxDuration], m = 1, n = 1, d = 0, i = 0;
      while (n < 1e9 && d < maxDuration) {
        // n to fill remaining time based on previous t/op. limit to at most 100x previous n / 1e9 total
        n = Math.min(Math.min((maxDuration - d) / ts[ts.length-1], m*10), 1e9);
        const start = performance.now();
        f(n);
        const elapsed = performance.now() - start;
        m = n, d += elapsed, i += m, ts.push(elapsed / n);
      }
      ts = ts.length > 2 ? ts.slice(2) : ts.slice(1);
      let avgT = ts.reduce((sum, t) => sum + t, 0) / ts.length, unit = "ms";
      if (avgT < 1) avgT = avgT * 1000, unit = "µs";
      t.log(`${avgT.toFixed(2)}${unit}/op\t${i.toLocaleString()} ops`, "grey");
    })});
  },

  fail(msg, info = "fail") {
    throw new Error(`${msg ? msg + ": " : ""}${info}`);
  },

  log(msg, color = "grey") {
    current.logs.push(...msg.split("\n").map(line => [line, color]));
  }
});

function throws(f, regexp = /.*/, msg, sync) {
  if (typeof f !== 'function') t.fail(`expected ${f} to be a function`);
  if (typeof regexp === 'string') msg = regexp, regexp = /.*/;
  let result = null, checkError = (err) => {
    if (!err) t.fail(msg, `expected ${f} to throw`);
    else if (!regexp.test(err.message)) t.fail(`expected ${f} to throw ${regexp}`, err.message);
  };
  try {
    result = f();
    if (!sync && result instanceof Promise) return result.then(checkError, checkError);
  } catch (err) {
    return void checkError(err);
  }
  if (result) t.fail(`${f} must not return a value`);
  checkError(null);
}

function wrapper(name, f, key) {
  if (!f) f = name, name = `${key} ${current.node[key + "s"].length}`;
  current.node[key + "s"].push({name, f});
}

function getEachWrappers(node) {
  const befores = [], afters = [];
  do {
    befores.push(...node.beforeEachs.reverse());
    afters.push(...node.afterEachs.reverse());
  } while (node = node.parent);
  return [befores.reverse(), afters.reverse()];
}

function group(name, f, selected) {
  current.node = newNode(name, current.node, selected);
  const result = f?.();
  if (result) throw new Error(`unexpected return value from describe: ${result}`);
  const [beforeEachs, afterEachs] = getEachWrappers(current.node);
  for (let child of current.node.children) {
    Object.assign(child, {beforeEachs, afterEachs});
  }
  current.node.parent.children.push(current.node);
  current.node = current.node.parent;
}

async function run(lvl, node) {
  current.node = null;
  const time = timer(), selected = !root.hasSelected || node.selected || node.hasSelected;
  if (selected && node !== window.test.root) log(lvl, 0, "", node.name);
  await loadFixtures(node);
  for (let {name, f} of node.befores) await runWrapper(lvl+2, node, name, f, selected);
  for (let child of node.children) {
    if (child.children) await run(lvl+2, child);
    else await runTest(lvl+2, node, child);
  }
  for (let {name, f} of node.afters) await runWrapper(lvl+2, node, name, f, selected);
  if (selected && node !== root) log(lvl, 0, "grey", `(${time()}ms)\n`);
  else if (node === root) {
    const details = dynamicOnly ? " - exit after dynamic only" : "";
    const color = countFailed ? "red" : dynamicOnly ? "yellow" : "grey";
    log(lvl+2, 0, color, `${count} tests (${countFailed} failures)${details}\n`);
  }
}

async function runWrapper(lvl, node, name, f, selected) {
  if (!selected) return;
  const [logs, ms, err] = await runFn(node, f, name);
  if (err) log(lvl, 1, "red", `x ${name} (${ms}ms)`, err);
  for (let [line, color] of logs) log(lvl+2, 1, color, line);
}

async function runTest(lvl, node, {name, f, selected, beforeEachs = [], afterEachs = []}) {
  if (root.hasSelected && !selected) return;
  count++;
  if (f) for (let {f, name} of beforeEachs) await runWrapper(lvl, node, name, f, true);
  const [logs, ms, err] = await runFn(node, f, name);
  if (f && !err) log(lvl, 0, "green", `✓ ${name} (${ms}ms)`);
  else if (!err) log(lvl, 0, "yellow", `✓ ${name}`);
  else {
    log(lvl, 1, "red", `x ${name} (${ms}ms)`, err);
    countFailed++;
  }
  for (let [line, color] of logs) log(lvl+2, 1, color, line);
  if (f) for (let {f, name} of afterEachs) await runWrapper(lvl, node, name, f, true);
}

async function runFn(node, f, name) {
  const time = timer(), logs = [];
  try {
    current = getCurrent(node, name, logs);
    const result = await Promise.race([f && f(), new Promise(r => setTimeout(() => r(node), 2000))]);
    current.node = null;
    if (result === node) t.fail("exceeded timeout of 2000ms");
    return [logs, time(), null];
  } catch (err) {
    return [[], time(), err];
  }
}

function getCurrent(node, name, logs) {
  let id = name, n = node;
  while (n.parent) id = `${n.name}: ${id}`, n = n.parent;
  return {id, logs, node};
}

function log(lvl, isFailure, color, line, err) {
  console[navigator.webdriver ? "error" : "info"](" ".repeat(lvl) + "%c" + line, "color: " + color);
  if (err) {
    if (!navigator.webdriver) console.info(err);
    else for (let l of err.stack.split("\n")) log(lvl+2, isFailure, "grey", l);
  }
}

function newNode(name, parent, selected) {
  return {name, parent, selected, children: [], fixtureUrl: "",
          befores: [], afters: [],
          beforeEachs: [], afterEachs: []};
}

function markNodes(node, key) {
  do { node[key] = true; } while (node = node.parent);
}

function timer() {
  const start = performance.now();
  return () => (performance.now() - start).toFixed();
}

function json(x, set = new WeakSet(), indent = 2) {
  return JSON.stringify(x, (k, v) => {
    if (Object(v) === v) {
      if (set.has(v)) return "[circular]";
      set.add(v);
    }
    return v;
  }, indent);
}

async function loadFixtures(node) {
  if (updateFixtures || window.test.fixtures[node.fixtureUrl]) return;
  window.test.fixtures[node.fixtureUrl] = await fetch(node.fixtureUrl)
    .then(r => r.json())
    .catch(() => ({}));
}

function getTestUrl() {
  const prepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (err, stack) => stack;
  const stack = new Error().stack;
  Error.prepareStackTrace = prepareStackTrace;
  const urls = typeof stack === "string" ?
        stack.match(/http:.*:\d+:\d+$/mg).map(s => s.replace(/:\d+:\d+$/, "")) :
        stack.map(f => f.getFileName());
  const testFile = urls.reverse().find(url => url !== import.meta.url);
  if (!testFile) throw new Error("could not find test file name");
  return new URL(testFile).pathname.replace(/\/$/, "/index.html");
}

function getFixtureUrl() {
  return getTestUrl().replace(/\/([^/]+)$/, "/fixtures/$1.json");
}

function beforeCreate(method, name, f) {
  if (f && !(f instanceof Function)) throw new Error(`${method}("${name}") bad function body`);
  if (!current.node.fixtureUrl) current.node.fixtureUrl = getFixtureUrl();
  if (!root.name) root.name = getTestUrl();
}

async function init() {
  const parentTest = window.parent.test;
  window.test = parentTest || await import(import.meta.url);
  if (parentTest) parentTest.current.node.children.push(root);
  else setTimeout(async () => {
    if (window.isCI && root.hasSelected) throw new Error("only not allowed in CI");
    await run(0, root);
    resolve({count, countFailed});
    if (updateFixtures) console.warn(json(fixtures));
    if (exitAfter) window.close(countFailed && 1);
  });
}

init();
