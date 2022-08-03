let hooks, hookKey, hookIndex, dbMap, oldHash;

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
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(String.raw(strings, ...values));
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
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

export function render(parentNode, vnode) {
  const f = () => renderChildren(parentNode, [vnode], vnode, f);
  f();
  return f;
}

function renderChildren(parentNode, vnodes, renderComponent) {
  let oldHooks = parentNode.hooks || {}, newHooks = {};
  hooks = oldHooks, hookIndex = 0, parentNode.hooks = newHooks;
  for (let i = 0; i < vnodes.length; i++) {
    renderChild(parentNode, vnodes[i], parentNode.childNodes[i], renderComponent);
  }
  for (let k in oldHooks) {
    if (!(k in newHooks)) for (let h of oldHooks[k]) h.unmount?.();
  }
  for (let n = parentNode.childNodes.length - vnodes.length; n > 0; n--) {
    unmount(parentNode.lastChild);
    parentNode.lastChild.remove()
  }
  hooks = undefined;
}

function renderChild(parentNode, vnode, node, renderComponent) {
  if (!hooks) hooks = parentNode.hooks;
  while (typeof vnode?.tag === "function") {
    let component = vnode;
    renderComponent = () => renderChild(parentNode, component, node, renderComponent);
    hookIndex = 0, hookKey = vnode.props.key || vnode.props.id;
    vnode = vnode.tag(vnode.props, renderComponent);
    if (hookIndex) parentNode.hooks[hookKey] = hooks[hookKey];
  }
  if (vnode == null) {
    if (node) unmount(node), node.remove();
  } else if (!vnode.tag) {
    if (node?.nodeType === 3) node.data = vnode;
    else replaceNode(parentNode, document.createTextNode(vnode), node);
  } else {
    if (!node || vnode.tag !== node.vnode?.tag) {
      node = replaceNode(parentNode, document.createElement(vnode.tag), node);
    }
    setProperties(node, vnode, renderComponent);
    if (hookIndex) {
      for (let h of parentNode.hooks[hookKey]) {
        if (h.mount && (h.changed || h.node !== node)) {
          if (h.unmount) h.unmount();
          h.unmount = h.mount(node), h.node = node, h.changed = false;
        }
      }
    }
    renderChildren(node, vnode.children, renderComponent);
  }
}

function unmount(node) {
  for (let k in node.hooks) {
    for (let h of node.hooks[k]) h.unmount?.();
  }
  for (let child of node.childNodes) unmount(child);
}

function replaceNode(parentNode, newNode, oldNode) {
  if (oldNode) unmount(oldNode), parentNode.replaceChild(newNode, oldNode);
  else parentNode.append(newNode);
  return newNode;
}

function setProperties(node, vnode, renderComponent) {
  for (let k in vnode.props) {
    setProperty(node, k, vnode.props[k], renderComponent);
  }
  if (node.vnode) {
    for (let k in node.vnode.props) {
      if (!(k in vnode.props)) setProperty(node, k, "", renderComponent);
    }
  }
  node.renderComponent = renderComponent;
  node.vnode = vnode;
}

function setProperty(node, k, v) {
  if (k in node && k !== "list" && k !== "form" && k !== "selected") node[k] = v == null ? "" : v;
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
  if (props["@"+e.type]) e.target.renderComponent();
}

export function db(v) {
  if (!dbMap) dbMap = Object.assign({}, JSON.parse(localStorage.getItem("db") || "{}"));
  if (v !== undefined) {
    Object.assign(dbMap, v);
    localStorage.setItem("db", JSON.stringify(dbMap));
  }
  return dbMap;
}

export function route(parentNode, routes) {
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
  render(x.parentNode, {tag, props: f(props)});
  if (oldHash !== location.hash) {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
    oldHash = location.hash;
  }
}
