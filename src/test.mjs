const root = newNode();
let node = root, count = 0, countFailed = 0, resolve;

export const done = new Promise((r) => resolve = r);

export function t(name, f) {
  node.children.push({name, f, selected: node.selected});
}

Object.assign(t, {
  describe(name, f) {
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

function group(name, f, selected) {
  node = newNode(name, node, selected);
  const result = f?.();
  if (result) throw new Error(`unexpected return value from describe: ${result}`);
  node.parent.children.push(node);
  node = node.parent;
}

async function run(lvl, node) {
  const time = timer(), selected = !root.hasSelected || node.selected || node.hasSelected;
  if (selected && node !== root) log(lvl, "", node.name);
  for (let {name, f} of node.befores) await runFn(lvl+2, name, f, false, selected);
  for (let child of node.children) {
    if (child.children) await run(lvl+2, child);
    else await runFn(lvl+2, child.name, child.f, true, !root.hasSelected || child.selected);
  }
  for (let {name, f} of node.afters) await runFn(lvl+2, name, f, false, selected);
  if (selected && node !== root) log(lvl, "color: grey", `(${time()}ms)\n`);
  else if (node === root) log(lvl + 2, "color: grey", `${count} tests (${countFailed} failures)\n`);
}

async function runFn(lvl, name, f, isTest, selected) {
  if (!selected) return;
  if (isTest) count++;
  const time = timer();
  try {
    if (f) await f();
    if (isTest && f) log(lvl, "color: green", `✓ ${name} (${time()}ms)`);
    else if (isTest) log(lvl, "color: yellow", `✓ ${name}`);
  } catch (err) {
    if (isTest) countFailed++;
    log(lvl, "color: red", `x ${name} (${time()}ms)`, ...err.stack.split("\n"));
  }
}

function log(lvl, color, line, ...lines) {
  console.info(" ".repeat(lvl) + "%c" + line, color);
  for (let l of lines) console.info(" ".repeat(lvl + 2) + "%c" + l, "color: grey");
}

function newNode(name, parent, selected) {
  return {name, parent, selected, children: [], befores: [], afters: []};
}

function markNodes(node, key) {
  do { node[key] = true } while (node = node.parent);
}

function isSelected(node) {
  return root.hasSelected ? node.selected || node.hasSelected : true;
}

function timer() {
  const start = performance.now()
  return () => (performance.now() - start).toFixed();
}

setTimeout(async () => {
  await run(0, node);
  resolve({count, countFailed});
});
