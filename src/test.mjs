let node = newNode(), count = 0;

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
  lvl += 2;
  for (let {name, f} of node.befores) await runFn(lvl, name, f, false);
  for (let child of node.children) {
    if (child.children) await run(lvl, child);
    else await runFn(lvl, child.name, child.f, true);
  }
  for (let {f} of node.afters) await f();
  lvl -= 2;

  const ms = performance.now() - start;
  if (lvl) log(lvl, "color: grey", `(${ms.toFixed()}ms)\n`);
  else log(lvl + 2, "color: grey", `${count} tests\n`);
}

async function runFn(lvl, name, f, isTest) {
  if (isTest) count++;
  try {
    const start = performance.now();
    await f?.();
    const ms = performance.now() - start;
    if (isTest && f) log(lvl, "color: green", `✓ ${name} (${ms.toFixed()}ms)`);
    else if (isTest) log(lvl, "color: yellow", `✓ ${name}`);
  } catch (err) {
    log(lvl, "color: red", `x ${name}`, ...err.stack.split("\n"));
  }
}

function log(lvl, color, line, ...lines) {
  console.info("%c" + " ".repeat(lvl) + line, color);
  for (let l of lines) console.info("%c" + " ".repeat(lvl + 2) + l, "color: grey");
}

function newNode(name) {
  return {name, children: [], befores: [], afters: []};
}

setTimeout(() => run(0, node));
