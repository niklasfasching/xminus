import * as exports from "./runtime.mjs";

const classes = {}, compilerTemplate = document.createElement("template");

export const symbols = {
  updateChildNode: Symbol("updateChildNode"),
  updateIfNode: Symbol("updateIfNode"),
  updateComponent: Symbol("updateComponent"),
};

export const ready = init();

async function init() {
  window.xm = exports;
  if (document.querySelector("[type*=x-module], [type*=x-template]")) {
    if (document.body.hasAttribute("x-dev")) document.querySelectorAll("[x-dev]").forEach((el) => el.removeAttribute("x-dev"));
    const {bundle} = await import("./bundler.mjs");
    await import(await bundle(location, null));
  }
  const xMount = document.querySelector("[type*=x-mount]");
  if (xMount) window.app = mount(xMount.parentNode, xMount.innerHTML, await window.props);
  await new Promise(setTimeout);
}

export function setProperty(node, k, v) {
  const inSVG = node.namespaceURI === "http://www.w3.org/2000/svg";
  if (k in node && k !== "list" && k !== "form" && k !== "selected" && !inSVG) node[k] = v == null ? "" : v;
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
  node = document.createTextNode(value == null || value === false ? "" : value);
  node[symbols.updateChildNode] = (updatedValue) => {
    oldValue = value, value = updatedValue;
    if (oldValue === updatedValue) return node;
    else if ((updatedValue instanceof Node)) return updatedValue;
    node.textContent = value == null || value === false ? "" : value;
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

export async function mount(parentNode, name, props = {}) {
  await ready;
  let app;
  if (name.trim()[0] !== "<") app = document.createElement(name);
  else {
    const {compile} = await import("./compiler.mjs");
    eval(compile("x-mount", `<x-mount x-props="${Object.keys(props).join(" ")}">${name}</>`));
    app = document.createElement("x-mount");
    app.style.display = "contents";
  }
  app.init(app, app, props);
  return parentNode.appendChild(app);
}

export function fragment(html, inSVG) {
  compilerTemplate.innerHTML = inSVG ? `<svg>${html}</svg>` : html;
  return document.importNode(inSVG ? compilerTemplate.content.firstChild : compilerTemplate.content, true);
}

export function define(name, c) {
  if (!(c.prototype instanceof Component)) throw new Error("class must inherit from Component");
  classes[name] = c;
}

export function register(name, html, f, assignedProps) {
  const template = document.createElement("template");
  template.innerHTML = `<div class=slot></div>`;
  const slotTemplate = template.content.firstChild;
  template.innerHTML = html;
  customElements.define(name, class extends (classes[name] || Component) {
    static name = name
    init(app, xParent, props) {
      this.xParent = xParent;
      this.app = app;
      this.props = props;
      this.slots = {rest: slotTemplate.cloneNode(true)};
      while (this.firstChild) {
        const slot = this.firstChild.getAttribute?.("x-slot");
        if (slot) this.slots[slot] = this.removeChild(this.firstChild);
        else this.slots.rest.append(this.firstChild);
      }
      for (let k of assignedProps) this[k] = this.props[k];
      this.onInit(this.props);
      this.append(document.importNode(template.content, true));
      this[symbols.updateComponent] = f.call(this);
      this.onCreate(this.props);
    }
    detachedCallback() {
      this.onRemove(this.props);
    }
    update(props = this.props) {
      this.props = props;
      for (let k of assignedProps) this[k] = this.props[k];
      this.onUpdate(this.props);
      this[symbols.updateComponent]();
    }
  });
}

export class Component extends HTMLElement {
  onInit(props) {}
  onCreate(props) {}
  onUpdate(props) {}
  onRemove(props) {}
}
