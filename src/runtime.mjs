export const components = {};

export function setProperty(node, k, v) {
  if (k in node && k !== "list" && k !== "form" && k !== "selected") node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v);
}

export function nodeIf(condition, ifNode, elseNode) {
  if (condition) {
    if (elseNode.parentNode) elseNode.parentNode.replaceChild(ifNode, elseNode);
    return ifNode;
  } else {
    if (ifNode.parentNode) ifNode.parentNode.replaceChild(elseNode, ifNode);
    return elseNode;
  }
}

export function updateFor(reference, nodeGroups, values, create, $) {
  const group = ([nodes, update]) => Object.assign(nodes, {update});
  updateNodeGroups(reference, nodeGroups, values, value => group(create($, value)));
}

export function createNodeGroup(value) {
  const group = Array.isArray(value) && (!value[0] || value[0] instanceof Node) ?
        value :
        [document.createTextNode(value)];
  group.update = (updatedValue) => {
    if (value !== updatedValue) {
      const first = group[0], parent = group[0].parentNode, nodes = createNodeGroup(value);
      for (let node of nodes) parent.insertBefore(node, first);
      for (let node of group) parent.removeChild(node);
      group.splice(0, group.length, ...nodes);
    }
    value = updatedValue;
  }
  return group;
}

export function updateNodeGroups(reference, nodeGroups, values, create) {
  const parent = reference.parentNode;
  for (let i = 0, j = 0; i < nodeGroups.length || j < values.length; i++, j++) {
    if (nodeGroups[i] && j < values.length) {
      nodeGroups[i].update(values[j]);
    } else if (nodeGroups[i]) {
      for (let node of nodeGroups[i]) parent.removeChild(node);
      delete nodeGroups[i];
    } else if (j < values.length) {

      const afterLast = (nodeGroups.slice(-1)[0]?.slice(-1)?.[0] || reference).nextSibling;
      nodeGroups[i] = create(values[j]);
      for (let node of nodeGroups[i]) parent.insertBefore(node, afterLast);
    }
  }
  nodeGroups.length = values.length;
}

export async function mount(parentNode, name, $, ...componentURLs) {
  const {generateCode} = await import("./compiler.mjs");
  window.xm = await import(import.meta.url);
  for (const url of [...componentURLs, location.toString()]) {
    try {
      await import(`data:text/javascript,${encodeURIComponent(await generateCode(url))}`);
    } catch (e) {
      throw new Error(`eval: ${e.message}:\n${url}`);
    }
  }
  if (!components[name]) throw new Error(`component ${name} does not exist`);
  parentNode.innerHTML = "";
  for (let node of components[name]($, {})[0]) parentNode.appendChild(node);
}
