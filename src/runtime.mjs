export const components = {};

export function setProperty(node, k, v) {
  if (k in node && k !== "list" && k !== "form" && k !== "selected") node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v);
}

export function replaceWith(oldNode, newNode) {
  if (newNode instanceof Fragment) newNode.refresh();
  oldNode.replaceWith(newNode);
}

export function nodeIf(condition, ifNode, elseNode) {
  if (condition) {
    if (elseNode.parentNode) replaceWith(elseNode, ifNode);
    return ifNode;
  } else {
    if (ifNode.parentNode) replaceWith(ifNode, elseNode);
    return elseNode;
  }
}

export function createChildNode($, value) {
  let node = value, oldValue;
  if (value instanceof DocumentFragment) node = new Fragment(value.childNodes);
  else if (!(value instanceof Node)) node = document.createTextNode(value);
  if (node.update) throw new Error("unexpected closure node");
  node.update = (updatedValue) => {
    oldValue = value, value = updatedValue;
    if (oldValue === updatedValue) return node;
    else if ((updatedValue instanceof Node)) return createChildNode($, updatedValue);
    else {
      node.textContent = updatedValue;
      return node;
    }
  }
  return node;
}

export function updateNodes(parent, anchor, nodes, values, updatedValues, $, create) {
  for (let i = updatedValues.length; i < values.length; i++) nodes[i].remove();
  values.length = updatedValues.length, nodes.length = updatedValues.length;
  for (let i = 0; i < updatedValues.length; i++) {
    if (!nodes[i]) {
      const node = create($, updatedValues[i]);
      parent.insertBefore(node, anchor);
      nodes[i] = node;
    } else {
      let oldNode = nodes[i], updatedValue = updatedValues[i];
      nodes[i] = oldNode.update ? oldNode.update(updatedValue) : create($, updatedValue);
      if (oldNode !== nodes[i]) replaceWith(oldNode, nodes[i]);
    }
    values[i] = updatedValues[i];
  }
}

export async function mount(parentNode, name, $) {
  window.xm = await import(import.meta.url);
  if (document.querySelector("[type*=x-module], [type*=x-template]")) {
    const {compile} = await import("./compiler.mjs");
    await import(await compile(location, true));
  }
  if (!components[name]) throw new Error(`component ${name} does not exist`);
  parentNode.innerHTML = "";
  parentNode.appendChild(components[name]($, {})[0]);
}

export class Fragment extends DocumentFragment {
  constructor(childNodes = []) {
    super();
    this._anchor = document.createComment("fragment anchor");
    this._childNodes = [...childNodes, this._anchor];
    this.append(...this._childNodes);
  }

  get nextSibling() {
    return this._childNodes[this._childNodes.length - 1].nextSibling;
  }

  replaceWith(node) {
    for (let i = 0; i < this._childNodes.length - 1; i++) this._childNodes[i].remove();
    replaceWith(this._anchor, node);
  }

  remove() {
    for (let node of this._childNodes) node.remove();
  }

  refresh() {
    if (!this.childNodes.length) this.append(...this._childNodes);
  }
}
