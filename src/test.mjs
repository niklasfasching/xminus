const root = newNode(), updatingFixtures = window.args?.includes("update-fixtures");
let node = root, count = 0, countFailed = 0, started = false, exitAfter = false, resolve;

export const done = new Promise((r) => resolve = r);

export function t(name, f) {
  if (started) throw new Error("t() must not be called async");
  node.children.push({name, f, selected: node.selected});
}

Object.assign(t, {
  describe(name, f) {
    if (started) throw new Error("t.describe() must not be called async");
    group(name, f);
  },

  describeOnly(name, f) {
    group(name, f, true);
    markNodes(node, "hasSelected");
  },

  only(name, f) {
    node.children.push({name, f, selected: true});
    markNodes(node, "hasSelected");
  },

  setupFixtures,

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

  throws(f, regexp = /.*/, msg) {
    if (typeof regexp === 'string') msg = regexp, regexp = /.*/;
    if (typeof f !== 'function') t.fail(`expected ${f} to be a function`);
    try {
      f();
    } catch(err) {
      if (!regexp.test(err.message)) t.fail(`expected ${f} to throw ${regexp}`, err.message);
      return;
    }
    t.fail(msg, `expected ${f} to throw`);
  },

  assert(x, msg) {
    if (!x) t.fail(msg, `${x} == true`);
  },

  equal(x, y, msg) {
    if (x != y) t.fail(msg, `${x} == ${y}`);
  },

  jsonEqual(x, y, msg) {
    x = json(x), y = json(y);
    if (x !== y) t.fail(msg, `${x} !== ${y}`);
  },

  strictEqual(x, y, msg) {
    if (x !== y) t.fail(msg, `${x} === ${y}`);
  },

  fail(msg, info = "fail") {
    throw new Error(`${msg ? msg + ": " : ""}${info}`);
  },
});

function wrapper(name, f, key) {
  if (!f) f = name, name = `${key} ${node[key + "s"].length}`;
  node[key + "s"].push({name, f});
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
  node = newNode(name, node, selected);
  const result = f?.();
  if (result) throw new Error(`unexpected return value from describe: ${result}`);
  const [beforeEachs, afterEachs] = getEachWrappers(node);
  for (let child of node.children) {
    Object.assign(child, {beforeEachs, afterEachs});
  }
  node.parent.children.push(node);
  node = node.parent;
}

async function run(lvl, node) {
  const time = timer(), selected = !root.hasSelected || node.selected || node.hasSelected;
  if (selected && node !== root) log(lvl, 0, "", node.name);
  for (let {name, f} of node.befores) await runWrapper(lvl+2, name, f, selected);
  for (let child of node.children) {
    if (child.children) await run(lvl+2, child);
    else await runTest(lvl+2, child);
  }
  for (let {name, f} of node.afters) await runWrapper(lvl+2, name, f, selected);
  if (selected && node !== root) log(lvl, 0, "color: grey", `(${time()}ms)\n`);
  else if (node === root) log(lvl + 2, 0, "color: grey", `${count} tests (${countFailed} failures)\n`);
}

async function runWrapper(lvl, name, f, selected) {
  if (!selected) return;
  const [ms, err] = await runFn(f, name);
  if (err) log(lvl, 1, "color: red", `x ${name} (${ms}ms)`, ...err.stack.split("\n"));
}

async function runTest(lvl, {name, f, selected, beforeEachs = [], afterEachs = []}) {
  if (root.hasSelected && !selected) return;
  count++;
  if (f) for (let {f, name} of beforeEachs) await runWrapper(lvl, name, f, true);
  const [ms, err] = await runFn(f, name);
  if (f && !err) log(lvl, 0, "color: green", `✓ ${name} (${ms}ms)`);
  else if (!err) log(lvl, 0, "color: yellow", `✓ ${name}`);
  else {
    log(lvl, 1, "color: red", `x ${name} (${ms}ms)`, ...err.stack.split("\n"));
    countFailed++;
  }
  if (f) for (let {f, name} of afterEachs) await runWrapper(lvl, name, f, true);
}

async function runFn(f, name) {
  const time = timer();
  try {
    if (f) await f(name);
    return [time(), null];
  } catch (err) {
    return [time(), err];
  }
}

function log(lvl, isFailure, color, line, ...lines) {
  if (updatingFixtures && !isFailure) return;
  console.info(" ".repeat(lvl) + "%c" + line, color);
  for (let l of lines) console.info(" ".repeat(lvl + 2) + "%c" + l, "color: grey");
}

function newNode(name, parent, selected) {
  return {name, parent, selected, children: [],
          befores: [], afters: [],
          beforeEachs: [], afterEachs: []};
}

function markNodes(node, key) {
  do { node[key] = true } while (node = node.parent);
}

function timer() {
  const start = performance.now()
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

function setupFixtures(path) {
  let fixtures, updatedFixtures = {};
  t.before(async () => {
    fixtures = await fetch(path).then(r => r.json()).catch(() => ({}));
  });
  t.after(() => {
    if (updatingFixtures) console.info(json(updatedFixtures));
  });
  return function(actual, msg) {
    const id = actual?.id;
    delete actual.id;
    if (id == null) t.fail(msg, "actual value must have id property");
    else if (!updatingFixtures) t.jsonEqual(actual, fixtures[id])
    else {
      if (updatedFixtures[id]) t.fail(`reassignment of fixture "${id}"`);
      updatedFixtures[id] = actual;
    }
  }
}

setTimeout(async () => {
  started = true;
  await run(0, node);
  resolve({count, countFailed});
  if (exitAfter) window.close(countFailed && 1);
});
