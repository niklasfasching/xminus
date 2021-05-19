const root = newNode(), updateFixtures = window.args?.includes("update-fixtures"), fixtures = {};
let currentNode = root, currentID = "",
    count = 0, countFailed = 0,
    dynamicOnly = false, exitAfter = false, resolve = null;

export const done = new Promise((r) => resolve = r);

function assertFunctionBody(method, name, f) {
  if (f && !(f instanceof Function)) throw new Error(`${method}("${name}") bad function body`);
}

export function t(name, f) {
  assertFunctionBody("t", name, f);
  currentNode.children.push({name, f, selected: currentNode.selected});
}

Object.assign(t, {
  describe(name, f) {
    assertFunctionBody("t.describe", name, f);
    group(name, f);
  },

  describeOnly(name, f) {
    assertFunctionBody("t.describeOnly", name, f);
    group(name, f, true);
    markNodes(currentNode, "hasSelected");
    if (count || countFailed) dynamicOnly = true;
  },

  only(name, f) {
    assertFunctionBody("t.only", name, f);
    currentNode.children.push({name, f, selected: true});
    markNodes(currentNode, "hasSelected");
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
    if (!updateFixtures) t.jsonEqual(actual, currentNode.fixtures[currentID]);
    else {
      fixtures[currentNode.testFile] = fixtures[currentNode.testFile] || {};
      if (fixtures[currentNode.testFile][currentID]) t.fail(`reassignment of fixture "${currentID}"`);
      fixtures[currentNode.testFile][currentID] = actual;
    }
  },

  fail(msg, info = "fail") {
    throw new Error(`${msg ? msg + ": " : ""}${info}`);
  },
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
  currentNode = newNode(name, getTestFile(), currentNode, selected);
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
    log(lvl + 2, 0, color, `${count} tests (${countFailed} failures)${details}\n`);
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
    currentNode = node, window._test_currentNode = node, currentID = id(node, name);
    if (f) await f();
    currentNode = null, window._test_currentNode = null, currentID = null;
    return [time(), null];
  } catch (err) {
    return [time(), err];
  }
}

function id(node, name) {
  let names = [name];
  do { names.push(node.name); } while (node = node.parent);
  return names.reverse().filter(Boolean).join(": ");
}

function log(lvl, isFailure, color, line, err) {
  console[navigator.webdriver ? "error" : "info"](" ".repeat(lvl) + "%c" + line, "color: " + color);
  if (err) {
    if (!navigator.webdriver) console.info(err);
    else for (let l of err.stack.split("\n")) log(lvl + 2, isFailure, "grey", l);
  }
}

function newNode(name, testFile, parent, selected) {
  return {name, testFile, parent, selected, children: [], fixtures: {},
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
  if (!node.parent || updateFixtures) return;
  const url = new URL(node.testFile).pathname.replace(/\/([^/]+)\.\w+$/, "/fixtures/$1.json");
  if (!fixtures[node.testFile]) fixtures[node.testFile] = await fetch(url).then(r => r.json()).catch(() => ({}));
  node.fixtures = fixtures[node.testFile];
}

function getTestFile() {
  const prepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (err, stack) => stack;
  const stack = new Error().stack;
  Error.prepareStackTrace = prepareStackTrace;
  while (stack.length) {
    const url = stack.shift().getFileName();
    if (url !== import.meta.url) return url;
  }
  throw new Error("could not find test file name");
}

const parentRoot = window !== window.parent && window.parent._test_currentNode;
if (parentRoot) parentRoot.children.push(Object.assign(root, {name: location.pathname}));
else setTimeout(async () => {
  if (window.isCI && root.hasSelected) throw new Error("only not allowed in CI");
  await run(0, root);
  resolve({count, countFailed});
  if (updateFixtures) {
    const [[_, fixture] = []] = Object.entries(fixtures);
    if (fixture) console.log(json(fixture));
  }
  if (exitAfter) window.close(countFailed && 1);
});
