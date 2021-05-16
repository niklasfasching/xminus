const classes = {}, compilerTemplate = document.createElement("template");

export const symbols = {
  updateChildNode: Symbol("updateChildNode"),
  updateIfNode: Symbol("updateIfNode"),
  updateComponent: Symbol("updateComponent"),
};

export function setProperty(node, k, v) {
  if (k in node && k !== "list" && k !== "form" && k !== "selected") node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v);
}

export function setDynamicKeyProperty(node, k, updatedK, v) {
  if (k !== updatedK) setProperty(node, k, null);
  setProperty(node, updatedK, v);
  return updatedK;
}

export function replaceWith(oldNode, newNode) {
  oldNode.replaceWith(newNode);
  return newNode;
}

export function nodeIf(condition, connectedNode, elseNode, $, create, update) {
  if (!condition) {
    if (connectedNode === elseNode) return elseNode;
    return replaceWith(connectedNode, elseNode);
  } else if (condition && connectedNode !== elseNode) {
    connectedNode[symbols.updateIfNode]();
    return connectedNode;
  }
  return replaceWith(elseNode, create($));
}

export function createChildNode($, value) {
  let node = value, oldValue;
  if (value instanceof DocumentFragment) throw new Error("Cannot use DocumentFragment as child");
  else if (value instanceof Node) return value;
  node = document.createTextNode(value);
  node[symbols.updateChildNode] = (updatedValue) => {
    oldValue = value, value = updatedValue;
    if (oldValue === updatedValue) return node;
    else if ((updatedValue instanceof Node)) return updatedValue;
    node.textContent = updatedValue;
    return node;
  };
  return node;
}

export function updateChildNodes(parent, anchor, nodes, values, updatedValues, $, create) {
  for (let i = updatedValues.length; i < values.length; i++) nodes[i].remove();
  values.length = updatedValues.length, nodes.length = updatedValues.length;
  for (let i = 0; i < updatedValues.length; i++) {
    if (!nodes[i]) {
      const node = create($, updatedValues[i]);
      parent.insertBefore(node, anchor);
      nodes[i] = node;
    } else if (nodes[i] !== updatedValues[i]) {
      let oldNode = nodes[i], updatedValue = updatedValues[i];
      nodes[i] = oldNode[symbols.updateChildNode] ? oldNode[symbols.updateChildNode](updatedValue) : create($, updatedValue);
      if (oldNode !== nodes[i]) replaceWith(oldNode, nodes[i]);
    }
    values[i] = updatedValues[i];
  }
}

export async function mount(parentNode, name, _$, _props) {
  window.xm = {register};
  window.xm = await import(import.meta.url);
  if (document.querySelector("[type*=x-module], [type*=x-template]")) {
    const {bundle} = await import("./bundler.mjs");
    await import(await bundle(location, null));
  }
  if (!location.hash) history.replaceState(null, null, "#/");
  const component = document.createElement(name);
  Object.assign(_$, {$update: () => component.updateCallback()}, parseHash());
  Object.assign(component, {_props, _$})
  window.onhashchange = () => {
    Object.assign(_$, parseHash());
    _$.$update();
  };
  parentNode.innerHTML = '';
  parentNode.appendChild(component);
}

export function fragment(html) {
  compilerTemplate.innerHTML = html;
  return compilerTemplate.content;
}

function parseHash() {
  const [$path, query] = location.hash.slice(1).split("?");
  return {$path, $query: Object.fromEntries(new URLSearchParams(query).entries())};
}

export function define(name, c) {
  if (!(c.prototype instanceof Component)) throw new Error("class must inherit from Component");
  classes[name] = c;
}

export function register(name, html, f) {
  const template = document.createElement("template");
  template.innerHTML = `<div class=slot></div>`;
  const slotTemplate = template.content.firstChild;
  template.innerHTML = html;
  customElements.define(name, class extends (classes[name] || Component) {
    connectedCallback() {
      this._slot = slotTemplate.cloneNode(true);
      for (let child of this.childNodes) this._slot.append(child);
      let {_$: $, _props: props, _slot: slot} = this;
      this.onInit($, props, slot);
      const fragment = template.content.cloneNode(true);
      this[symbols.updateComponent] = f.call(this, fragment, slot, $, props);
      this.append(fragment);
      this.onCreate($, props, slot);
    }
    updateCallback() {
      this.onUpdate(this._$, this._props, this._slot);
      this[symbols.updateComponent](this._props);
    }
    detachedCallback() {
      this.onRemove(this._$, this._props, this._slot);
    }
  });
}

export class Component extends HTMLElement {
  onInit($, props, slot) {}
  onCreate($, props, slot) {}
  onUpdate($, props, slot) {}
  onRemove($, props, slot) {}
}
