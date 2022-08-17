const attributes = new Set("list", "form", "selected");
let hooks, hookKey, hookIndex, dbMap, oldHash, style;

export function html(strings, ...values) {
  let $ = "child", xs = [{children: []}], tmp = "";
  for (let s of strings) {
    for (let i = 0, c = s[0]; i < s.length; i++, c = s[i]) {
      if ($ === "child" && c === "<") {
        if (tmp.trim() !== "") {
          xs[xs.length-1].children.push(tmp);
        }
        if (s[i+1] === "/") {
          $ = "close";
        } else {
          xs.push({children: [], props: []});
          $ = "open";
        }
      } else if (($ === "close" && c === ">")) {
        const x = xs.pop(), props = {};
        if (tmp && tmp !== "/" && tmp.slice(1) !== x.tag) {
          throw new Error(`unexpected <${tmp}> in <${x.tag}>`);
        }
        for (let i = 0; i < x.props.length; i += 2) {
          const k = x.props[i], v = x.props[i+1];
          if (k === "...") Object.assign(props, v);
          else if (k[0] === ".") v && (props.classList = (props.classList || "") + " " + k.slice(1));
          else if (k[0] === "#") v && (props.id = k.slice(1));
          else if (k[0] === "$") v && (x.ref = k.slice(1));
          else if (k[0] === "-" && k[1] === "-") props.style = (props.style || "") + `;${k}:${v};`;
          else props[k] = v;
        }
        x.props = props;
        xs[xs.length-1].children.push(x);
        $ = "child";
      } else if (($ === "open" || $ === "key" || $ === "value") &&
                 (c === " " || c === "\n" || c === ">" || (c === "/" && s[i+1] === ">"))) {
        if ($ === "open") {
          xs[xs.length-1].tag = tmp;
        } else if ($ === "key" && tmp) {
          xs[xs.length-1].props.push(tmp, true);
        } else if ($ === "value") {
          xs[xs.length-1].props.push(tmp);
        }
        $ = c === "/" ? "close" : c === ">" ? "child" : "key";
      } else if ($ === "key" && c === "=") {
        xs[xs.length-1].props.push(tmp);
        $ = s[i+1] === `'` || s[i+1] === `"` ? "quoted-value" : "value";
      } else if ($ === "quoted-value" && (c === tmp[0])) {
        xs[xs.length-1].props.push(tmp.slice(1));
        $ = "key";
      } else {
        tmp += c;
        continue
      }
      tmp = "";
    }

    let v = values.shift();
    if ($ !== "child" && v != null && v !== false) {
      tmp = tmp ? tmp + v : v;
    } else if ($ === "child") {
      if (tmp.trim() || values.length) {
        xs[xs.length-1].children.push(tmp);
        tmp = "";
      }
      if (Array.isArray(v)) xs[xs.length-1].children.push(...v);
      else if (v != null && v !== false) xs[xs.length-1].children.push(v);
    }
  }

  const children = xs.pop().children;
  if (tmp.trim()) {
    throw new Error(`leftovers: '${tmp}'`);
  } else if (xs.length) {
    throw new Error(`leftovers: ${JSON.stringify(xs)}`);
  } else if (children.length > 1) {
    throw new Error (`more than one top lvl node: ${JSON.stringify(children)}`)
  }
  return children[0];
}

export function css(strings, ...values) {
  if (!style) style = document.head.appendChild(document.createElement("style"));
  style.innerHTML += String.raw(strings, ...values);
}

export function useState(initialValue) {
  return getHook({value: initialValue}).value;
}

export function useEffect(mount, args = []) {
  const hook = getHook({});
  hook.changed = !hook.args || hook.args.some((a, i) => a !== args[i]);
  hook.args = args, hook.mount = mount;
}

export function getHook(v) {
  if (!hookKey) throw new Error(`getting hook from unkeyed component`);
  if (!hooks[hookKey]) hooks[hookKey] = [];
  let keyHooks = hooks[hookKey], hook = keyHooks[hookIndex++];
  return hook ? hook : keyHooks[keyHooks.push(v) - 1];
}

export function render(vnode, parentNode) {
  if (parentNode) return void renderChildren(parentNode, vnode, vnode);
  vnode = vnode.self || vnode.component || vnode;
  hooks = vnode.node.parentNode.hooks;
  renderChild(vnode.node.parentNode, vnode, vnode.node, vnode);
}

function renderChildren(parentNode, vnodes, component) {
  if (!Array.isArray(vnodes)) vnodes = [vnodes];
  let oldHooks = parentNode.hooks || {}, newHooks = {};
  hooks = oldHooks, hookIndex = 0, parentNode.hooks = newHooks;
  for (let i = 0; i < vnodes.length; i++) {
    renderChild(parentNode, vnodes[i], parentNode.childNodes[i], component);
  }
  for (let k in oldHooks) {
    if (!(k in newHooks)) for (let h of oldHooks[k]) h.unmount?.();
  }
  for (let n = parentNode.childNodes.length - vnodes.length; n > 0; n--) {
    unmount(parentNode.lastChild).remove();
  }
}

function renderChild(parentNode, vnode, node, component) {
  if (vnode == null) return node ? void unmount(node).remove() : null;
  if (!vnode.tag) return createTextNode(parentNode, vnode, node);
  if (typeof vnode.tag !== "function") {
    if (!node || vnode.tag !== node.vnode?.tag) node = createNode(parentNode, vnode.tag, node);
    if (vnode.ref) component.props.$[vnode.ref] = node;
    setProperties(node, vnode, component);
    renderChildren(node, vnode.children, component);
    return node;
  }
  vnode.props.$ = {self: vnode};
  hookIndex = 0, hookKey = vnode.props.key || vnode.props.id;
  const _vnode = vnode.tag(vnode.props), _hooks = hooks[hookKey];
  node = vnode.node = renderChild(parentNode, _vnode, node, vnode);
  if (_hooks) {
    parentNode.hooks[hookKey] = _hooks;
    for (let h of _hooks) {
      if (h.mount && (h.changed || h.node !== node)) {
        if (h.unmount) h.unmount();
        h.unmount = h.mount(node), h.node = node, h.changed = false;
      }
    }
  }
  if (vnode.ref) component.props.$[vnode.ref] = node;
  return node;
}

function unmount(node) {
  for (let k in node.hooks) {
    for (let h of node.hooks[k]) h.unmount?.();
  }
  for (let child of node.childNodes) unmount(child);
  return node;
}

function createNode(parentNode, tag, node) {
  return replaceNode(parentNode, document.createElement(tag), node);
}

function createTextNode(parentNode, vnode, node) {
  if (node?.nodeType === 3) node.data = vnode;
  else node = replaceNode(parentNode, document.createTextNode(vnode), node);
  return node;
}

function replaceNode(parentNode, newNode, oldNode) {
  if (oldNode) unmount(oldNode), parentNode.replaceChild(newNode, oldNode);
  else parentNode.append(newNode);
  return newNode;
}

function setProperties(node, vnode, component) {
  for (let k in vnode.props) {
    if (node.vnode && (k in node.vnode.props) && node.vnode.props[k] === vnode.props[k]) continue;
    setProperty(node, k, vnode.props[k]);
  }
  if (node.vnode) {
    for (let k in node.vnode.props) {
      if (!(k in vnode.props)) setProperty(node, k, "");
    }
  }
  vnode.node = node, node.vnode = vnode, node.component = component;
}

function setProperty(node, k, v) {
  if (k in node && !attributes.has(k)) node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else if (k[0] === "@") setEventListener(node, k.slice(1), eventListener, eventListener);
  else if (k[0] == "o" && k [1] == "n") setEventListener(node, k.slice(2), eventListener, eventListener);
  else node.setAttribute(k, v);
}

function setEventListener(node, type, f, g) {
  if (g) node.removeEventListener(type, g);
  if (f) node.addEventListener(type, f);
}

function eventListener(e) {
  const props = e.target.vnode.props;
  const v = props["on"+e.type] || props["@"+e.type];
  if (Array.isArray(v)) v[0](e, ...v.slice(1));
  else v(e);
  if (props["@"+e.type]) render(e.target.component);
}

export function db(v) {
  if (!dbMap) dbMap = Object.assign({}, JSON.parse(localStorage.getItem("db") || "{}"));
  if (v !== undefined) {
    Object.assign(dbMap, v);
    localStorage.setItem("db", JSON.stringify(dbMap));
  }
  return dbMap;
}

export function route(routes, parentNode) {
  const x = {
    parentNode,
    routes: Object.entries(routes || []).map(([path, component]) => [
      new RegExp("^" + path.replace(/\/?$/, "/?$").replaceAll(/{(\w+)}/g, "(?<$1>[^/]+)")),
      component,
    ]),
  };
  window.addEventListener("popstate", () => renderRoute(x));
  renderRoute(x);
  return () => renderRoute(x);
}

function renderRoute(x) {
  if (!location.hash) history.replaceState(null, null, "#/");
  const [path, query] = location.hash.slice(1).split("?");
  const [r, [tag, f = x => x]] = x.routes.find(([r]) => r.test(path)) || [null, []];
  if (!r) return void (location.hash = "#/");
  const props = Object.assign({}, new URLSearchParams(query).entries());
  const params = r.exec(path).groups;
  for (const k in params) props[k] = decodeURIComponent(params[k]);
  render({tag, props: f(props)}, x.parentNode);
  if (oldHash !== location.hash) {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
    oldHash = location.hash;
  }
}
