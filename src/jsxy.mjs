const attrs = new Set("list", "form", "selected"), subs = new Map();
let hooks, hookKey, hookIndex, oldSearch, oldHash, style;

export const directives = {
  store: applyStoreDirective,
  href: applyHrefDirective,
  intersect: applyIntersectDirective,
}

export const db = new Proxy(localStorage, {
  get: (t, k) => JSON.parse(t.getItem(k)),
  set: (t, k, v) => {
    t.setItem(k, JSON.stringify(v));
    if (!publish.active) publish(db, k, v);
    return true;
  },
  deleteProperty: (t, k) => (t.removeItem(k), true),
  ownKeys: (t) => Reflect.ownKeys(t),
  getOwnPropertyDescriptor: (t, k) => Reflect.getOwnPropertyDescriptor(t, k),
});

export const query = new Proxy(searchParams, {
  get: (t, k) => {
    const v = t()[1].get(k);
    return v && (v[0] === "[" || v[0] === "{") ? JSON.parse(v) : v;
  },
  set: (t, k, v) => {
    const [path, q] = t(), sv = Object(v) === v ? JSON.stringify(v) : v;
    q[sv != null && sv !== "" ? "set" : "delete"](k, sv);
    history.replaceState(null, "", "?"+path+(q.size ? "&"+q : "")+location.hash);
    if (!publish.active) publish(query, k, v);
    return true;
  },
  deleteProperty: (t, k) => (query[k] = undefined, true),
  ownKeys: (t) => [...t().keys()],
  getOwnPropertyDescriptor: (t, k) => ({enumerable: 1, configurable: 1}),
});

export function sub(store, k, f) {
  if (!subs.has(store)) subs.set(store, {});
  subs.get(store)[k] = [f].concat(subs.get(store)[k] || []);
  return () => subs.get(store)[k] = subs.get(store)[k].filter(x => x !== f);
}

function publish(store, k, v) {
  publish.active = true;
  if (subs.get(store) && k in subs.get(store)) for (let f of subs.get(store)[k]) f(v);
  delete publish.active;
}

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
          $ = "#$:.-".includes(s[i+1]) ? "key" : "open";
        }
      } else if (($ === "close" && c === ">")) {
        const x = xs.pop(), props = x.props.length || typeof x.tag === "function" ? {} : undefined;
        if (!("tag" in x)) x.tag = "div";
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
          else if (k[0] === ":") x.dirs = {...x.dirs, [k]: v}
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

function renderChildren(parentNode, vnodes, component, ns) {
  if (!Array.isArray(vnodes)) vnodes = [vnodes];
  let oldHooks = parentNode.hooks || {}, newHooks = {}, nodes = [...parentNode.childNodes];
  hooks = oldHooks, parentNode.hooks = newHooks;
  for (let i = 0; i < vnodes.length; i++) {
    renderChild(parentNode, vnodes[i], nodes[i], component, ns);
  }
  for (let k in oldHooks) {
    if (!(k in newHooks)) for (let h of oldHooks[k]) h.unmount?.();
  }
  for (let i = nodes.length-1; i >= vnodes.length; i--) {
    unmount(nodes[i]).remove()
  }
}

function renderChild(parentNode, vnode, node, component, ns) {
  if (vnode == null) return node ? void unmount(node).remove() : null;
  if (!vnode.tag) return createTextNode(parentNode, vnode, node);
  if (typeof vnode.tag !== "function") {
    ns = vnode.props?.xmlns || ns
    if (!node || vnode.tag !== node.vnode?.tag) node = createNode(parentNode, vnode.tag, node, ns);
    if (vnode.ref) component.props.$[vnode.ref] = node;
    if (vnode.props || node.vnode?.props) setProperties(node, vnode, component, ns);
    vnode.node = node, node.vnode = vnode, node.component = component;
    renderChildren(node, vnode.children, component, ns);
    if (vnode.dirs) applyDirectives(node, vnode)
    return node;
  }
  vnode.props.$ = {self: vnode, app: component.props?.$?.app || component};
  hookIndex = 0, hookKey = vnode.props.key || vnode.props.id;
  const _hooks = hooks, _vnode = vnode.tag(vnode.props), _vnodeHooks = _hooks[vnode.props.key];
  node = vnode.node = renderChild(parentNode, _vnode, node, vnode, ns), hooks = _hooks;
  if (_vnodeHooks) {
    parentNode.hooks[vnode.props.key] = _vnodeHooks;
    for (let h of _vnodeHooks) {
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

function createNode(parentNode, tag, node, ns) {
  const newNode = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  return replaceNode(parentNode, newNode, node);
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

function setProperties(node, vnode, component, ns) {
  for (let k in vnode.props) {
    if (node.vnode?.props?.[k] !== vnode.props[k]) setProperty(node, k, vnode.props[k], ns);
  }
  if (node.vnode) {
    for (let k in node.vnode.props) {
      if (!vnode.props || !(k in vnode.props)) setProperty(node, k, "");
    }
  }
}

function setProperty(node, k, v, ns) {
  if (k[0] == "o" && k [1] == "n") setEventListener(node, k.slice(2), eventListener, eventListener);
  else if (k[0] === "@") setEventListener(node, k.slice(1), eventListener, eventListener);
  else if (k in node && !attrs.has(k) && !ns) node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v);
}

function setEventListener(node, type, f, g) {
  if (g) node.removeEventListener(type, g);
  if (f) node.addEventListener(type, f);
}

function eventListener(e) {
  const props = this.vnode.props;
  const v = props["on"+e.type] || props["@"+e.type];
  if (Array.isArray(v)) v[0](e, ...v.slice(1));
  else v(e);
  if (props["@"+e.type]) render(e.target.component);
}

function applyDirectives(node, vnode) {
  for (const dk in vnode.dirs) {
    const [_, k, ...args] = dk.split(":"), f = directives[k], v = vnode.dirs[dk];
    if (f) node.dataset[k] = f(node, vnode, args, v, node.dataset[k]);
  }
}

function applyStoreDirective(node, {tag, props}, [type, key], v, data) {
  const store = {query, db}[type];
  if (tag !== "form") throw new Error(`:store on non-form tag '${tag}'`)
  else if (!key || !store) throw new Error("bad key or type in :store:<type>:<key>");
  if (!data) {
    node.addEventListener("submit", (e) => e.preventDefault());
    node.addEventListener("reset", (e) => delete store[key]);
    node.addEventListener("input", (e) => {
      const fd = new FormData(node), m = {};
      iterateForm(node, (k, el, k2) => {
        const vs = fd.getAll(k);
        if (!k2) m[k] = vs[0];
        else if (vs.length) m[k] = Object.fromEntries(vs.map(k => [k, true]));
      });
      store[key] = m;
    });
  }
  const m = store[key];
  iterateForm(node, (k, el, k2) => {
    const v = m && m[k];
    if (k2) for (const x of el) x[k2] = v && v[x.value];
    else if (el.type === "checkbox") el.checked = v;
    else el.value = v == null ? "" : v;
  });
  return true;
}

function applyIntersectDirective(node, {tag, props}, args, rootMargin = "0% 100%", data) {
  if (!data) {
    const observer = new IntersectionObserver((xs, observer) => {
      for (const x of xs) x.target.classList.toggle("intersecting", x.isIntersecting);
    }, {rootMargin});
    observer.observe(node);
  }
  return true;
}

function applyHrefDirective(node, {tag, props}, args, href, data) {
  node.href = href;
  if (!data) node.addEventListener("click", (e) => (route.go(node.href), e.preventDefault()));
  return true;
}

function iterateForm(form, f) {
  for (let k of new Set([...form.elements].map(el => el.name).filter(Boolean))) {
    const el = form.elements[k];
    if (!el.multiple && !(!el.type && el[0].type === "checkbox")) f(k, el);
    else f(k, (el.options || el), el.options ? "selected" : "checked");
  }
}

export function route(routes, parentNode) {
  route.go = (href) => (history.pushState({}, "", href), renderRoute(routes, parentNode));
  window.addEventListener("popstate", () => renderRoute(routes, parentNode));
  renderRoute(routes, parentNode);
}

function renderRoute(routes, parentNode) {
  const [path, q] = searchParams(), params = Object.fromEntries(q);
  if (!(location.hash !== oldHash && location.search === oldSearch)) {
    for (let [r, tag] of Object.entries(routes)) {
      if (matchRoute(r, path, params)) {
        if (location.search !== oldSearch) {
          window.scrollTo(0, 0);
          document.activeElement?.blur?.();
        }
        Object.assign(route, {path, params});
        render({tag, props: params}, parentNode);
        oldSearch = location.search;
        break;
      }
    }
  }
  if (location.search !== oldSearch) return void route.go("?/");
  dispatchHashEvent(oldHash, "leave");
  dispatchHashEvent(location.hash, "enter");
  oldHash = location.hash;
}

function matchRoute(route, path, params) {
  const r = new RegExp("^" + route.replace(/\/?$/, "/?$").replace(/\/{(.+?)}/g, (_, x) =>
    x.startsWith("...") ? `(?<${x.slice(3)}>(/.*)?)` : `/(?<${x}>[^/]+)`
  ));
  const match = r.exec(path);
  if (match) {
    params.key = route;
    for (const k in match.groups) params[k] = decodeURIComponent(match.groups[k]);
    return true;
  }
}

function dispatchHashEvent(hash = "", type) {
  const [id, ...args] = hash.split(":"), el = id && document.querySelector(id);
  if (el) {
    void el.offsetWidth; // reflow
    el.classList.toggle("target", type === "enter");
    el.dispatchEvent(new CustomEvent("hash", {detail: {id, args, type}}));
  }
}

function searchParams() {
  const q = location.search, [path] = q.slice(1).split("&", 1);
  return [path, new URLSearchParams(q.slice(path.length+1))];
}
