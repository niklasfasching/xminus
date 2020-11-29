let node = newNode(), count = 0, countFailed = 0, resolve;

export const done = new Promise((r) => resolve = r);

export function t(name, f) {
  node.children.push({name, f});
}

Object.assign(t, {
  describe(name, f) {
    const parent = node;
    node = newNode(name);
    const result = f?.();
    if (result) throw new Error(`unexpected return value from describe: ${result}`);
    parent.children.push(node);
    node = parent;
  },

  before(name, f) {
    if (!f) f = name, name = `before ${node.befores.length}`;
    node.befores.push({name, f});
  },

  after(name, f) {
    if (!f) f = name, name = `after ${node.afters.length}`;
    node.afters.push({name, f});
  },

  assert(x, msg) {
    if (!x) t.fail(msg, `${x} == true`);
  },

  assertEqual(x, y, msg) {
    if (x != y) t.fail(msg, `${x} == ${y}`);
  },

  assertStrictEqual(x, y, msg) {
    if (x != y) t.fail(msg, `${x} === ${y}`);
  },

  fail(msg, info = "fail") {
    throw new Error(`${msg ? msg + ": " : ""}${info}`);
  },
});

async function run(lvl, node) {
  const start = performance.now();
  if (lvl) log(lvl, "", node.name);
  for (let {name, f} of node.befores) await runFn(lvl+2, name, f, false);
  for (let child of node.children) {
    if (child.children) await run(lvl+2, child);
    else await runFn(lvl+2, child.name, child.f, true);
  }
  for (let {name, f} of node.afters) await runFn(lvl+2, name, f, false);
  if (lvl) log(lvl, "color: grey", `(${(performance.now() - start).toFixed()}ms)\n`);
  else log(lvl + 2, "color: grey", `${count} tests (${countFailed} failures)\n`);
}

async function runFn(lvl, name, f, isTest) {
  if (isTest) count++;
  const start = performance.now();
  try {
    if (f) await f();
    if (isTest && f) log(lvl, "color: green", `✓ ${name} (${(performance.now() - start).toFixed()}ms)`);
    else if (isTest) log(lvl, "color: yellow", `✓ ${name}`);
  } catch (err) {
    if (isTest) countFailed++;
    log(lvl, "color: red", `x ${name} (${(performance.now() - start).toFixed()}ms)`, ...err.stack.split("\n"));
  }
}

function log(lvl, color, line, ...lines) {
  console.info(" ".repeat(lvl) + "%c" + line, color);
  for (let l of lines) console.info(" ".repeat(lvl + 2) + "%c" + l, "color: grey");
}

function newNode(name) {
  return {name, children: [], befores: [], afters: []};
}

setTimeout(async () => {
  await run(0, node);
  resolve({count, countFailed});
});
