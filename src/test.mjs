const root = newNode(), updatingFixtures = window.args?.includes("update-fixtures");
let currentNode = root, pendingAssertions = [],
    count = 0, countFailed = 0,
    dynamicOnly = false, exitAfter = false, resolve = null;

export const done = new Promise((r) => resolve = r);

export function t(name, f) {
  if (!currentNode) throw new Error("t() must not be called async");
  currentNode.children.push({name, f, selected: currentNode.selected});
}

Object.assign(t, {
  describe(name, f) {
    if (!currentNode) throw new Error("t.describe() must not be called async");
    group(name, f);
  },

  describeOnly(name, f) {
    if (!currentNode) throw new Error("t.describe() must not be called async");
    group(name, f, true);
    markNodes(currentNode, "hasSelected");
    if (count || countFailed) dynamicOnly = true;
  },

  only(name, f) {
    if (!currentNode) throw new Error("t() must not be called async");
    currentNode.children.push({name, f, selected: true});
    markNodes(currentNode, "hasSelected");
    if (count || countFailed) dynamicOnly = true;
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

  async throws(f, regexp = /.*/, msg) {
    if (typeof regexp === 'string') msg = regexp, regexp = /.*/;
    if (typeof f !== 'function') t.fail(`expected ${f} to be a function`);
    const pop = pushPendingAssertion("throws", f.toString());
    try {
      await f();
      pop();
    } catch(err) {
      pop();
      if (!regexp.test(err.message)) t.fail(`expected ${f} to throw ${regexp}`, err.message);
      return;
    }
    t.fail(msg, `expected ${f} to throw`);
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

  fail(msg, info = "fail") {
    throw new Error(`${msg ? msg + ": " : ""}${info}`);
  },
});

function pushPendingAssertion(key, value) {
  const pending = `${key}: ${value}`;
  pendingAssertions.push(pending);
  return () => {
    pendingAssertions = pendingAssertions.filter(_ => _ != pending);
  };
}

function wrapper(name, f, key) {
  if (!f) f = name, name = `${key} ${currentNode[key + "s"].length}`;
  currentNode[key + "s"].push({name, f});
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
  currentNode = newNode(name, currentNode, selected);
  const result = f?.();
  if (result) throw new Error(`unexpected return value from describe: ${result}`);
  const [beforeEachs, afterEachs] = getEachWrappers(currentNode);
  for (let child of currentNode.children) {
    Object.assign(child, {beforeEachs, afterEachs});
  }
  currentNode.parent.children.push(currentNode);
  currentNode = currentNode.parent;
}

async function run(lvl, node) {
  currentNode = null;
  const time = timer(), selected = !root.hasSelected || node.selected || node.hasSelected;
  if (selected && node !== root) log(lvl, 0, "", node.name);
  currentNode = node, window._test_currentNode = node;
  for (let {name, f} of node.befores) await runWrapper(lvl+2, node, name, f, selected);
  currentNode = null, window._test_currentNode = null;
  for (let child of node.children) {
    if (child.children) await run(lvl+2, child);
    else await runTest(lvl+2, node, child);
  }
  for (let {name, f} of node.afters) await runWrapper(lvl+2, node, name, f, selected);
  if (selected && node !== root) log(lvl, 0, "grey", `(${time()}ms)\n`);
  else if (node === root) {
    const details = dynamicOnly ? " - exit after dynamic only" : ""
    log(lvl + 2, 0, dynamicOnly ? "yellow" : "grey", `${count} tests (${countFailed} failures)${details}\n`);
  }
}

async function runWrapper(lvl, node, name, f, selected) {
  if (!selected) return;
  const [ms, err] = await runFn(node, f, name);
  if (err) log(lvl, 1, "red", `x ${name} (${ms}ms)`, err);
}

async function runTest(lvl, node, {name, f, selected, beforeEachs = [], afterEachs = []}) {
  if (root.hasSelected && !selected) return;
  count++;
  if (f) for (let {f, name} of beforeEachs) await runWrapper(lvl, node, name, f, true);
  const [ms, err] = await runFn(node, f, name);
  if (f && !err) log(lvl, 0, "green", `✓ ${name} (${ms}ms)`);
  else if (!err) log(lvl, 0, "yellow", `✓ ${name}`);
  else {
    log(lvl, 1, "red", `x ${name} (${ms}ms)`, err);
    countFailed++;
  }
  if (f) for (let {f, name} of afterEachs) await runWrapper(lvl, node, name, f, true);
}

async function runFn(node, f, name) {
  const time = timer();
  try {
    if (f) await f(id(node, name));
    if (pendingAssertions.length) t.fail(`did not await all assertions: ${pendingAssertions}`);
    return [time(), null];
  } catch (err) {
    pendingAssertions = [];
    return [time(), err];
  }
}

function id(node, name) {
  let names = [name];
  do { names.push(node.name) } while (node = node.parent);
  return names.reverse().filter(Boolean).join(": ");
}

function log(lvl, isFailure, color, line, err) {
  if (updatingFixtures && !isFailure) return;
  console.info(" ".repeat(lvl) + "%c" + line, "color: " + color);
  if (err) {
    if (!navigator.webdriver) console.error(err);
    else for (let l of err.stack.split("\n")) log(lvl + 2, false, "grey", l);
  }
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
    if (!id) t.fail(msg, "actual value must have id property");
    else if (!updatingFixtures) t.jsonEqual(actual, fixtures[id])
    else {
      if (updatedFixtures[id]) t.fail(`reassignment of fixture "${id}"`);
      updatedFixtures[id] = actual;
    }
  }
}

const parentRoot = window !== window.parent && window.parent._test_currentNode;
if (parentRoot) parentRoot.children.push(Object.assign(root, {name: location.pathname}));
else setTimeout(async () => {
  if (window.isCI && root.hasSelected) throw new Error("only not allowed in CI")
  await run(0, root);
  resolve({count, countFailed});
  if (exitAfter) window.close(countFailed && 1);
});
