import {parse, parseValue, parseValueParts} from "./parser.mjs";

const macros = [
  [/^\.if$/, ifMacro],
  [/^\.for$/, forMacro],
  [/^\.on:/, onMacro],
  [/^\.bind:/, bindMacro]
];

function bindMacro(vnode, $, key, value) {
  const [_, property] = key.split(":");
  generateVnode(vnode, $);
  const event = ["input", "textarea"].includes(vnode.tag) ? "keyup" : "change";
  const node = generateLocalNodeName($, vnode, "bind");
  $.create += `if (${value} !== undefined) ${node}["${property}"] = ${value};\n
               ${node}.addEventListener("${event}", () => ${value} = ${node}["${property}"]);\n`;
  $.update += `if (document.activeElement !== ${node}) ${node}["${property}"] = ${value};\n`;
}

function onMacro(vnode, $, key, value) {
  generateVnode(vnode, $);
  const [_on_, event, ...modifiers] = key.split(":")
  if (event === "update" || event === "create") {
    const node = generateLocalNodeName($, vnode, "on");
    $.create += `function ${node}_fn() { ${value} }\n`;
    $[event] += `setTimeout(() => ${node}_fn.call(${node}));\n`;
  } else {
    let after = "$.$update();";
    if (modifiers.includes("no")) after = "";
    $.create += `${vnode.node}.addEventListener("${event}", function($event) {
                 ${value};
                 ${after}
               });\n`;
  }
}

function ifMacro(vnode, $, key, value) {
  const _ = prefix("if");
  generateClosure(vnode, $, _);
  $.create += `let [${_}connected, ${_}update] = xm.nodeIf((${value}), ${_}anchor, ${_}anchor, $, ${_}create);
               ${vnode.node} = ${_}connected;\n`;
  $.update += `[${_}connected, ${_}update] = xm.nodeIf((${value}), ${_}connected, ${_}anchor, $, ${_}create, ${_}update);\n`;
}

function forMacro(vnode, $, key, value) {
  const _ = prefix("for"),
        [name, inOrOf, values] = value.split(/ (of|in) /);
  generateClosure(vnode, $, _,
                  `$ = Object.assign(Object.create($), {"${name}": _args[0]});`,
                  `$["${name}"] = _args[0];`);
  $.create += `const ${_}values = [], ${_}nodes = [], ${_}createFor = ($, value) => {
                 const [node, update] = ${_}create($, value);
                 node.update = (value) => {
                   update(value);
                   return node;
                 };
                 return node;
               };
               xm.updateNodes(${_}anchor.parentNode, ${_}anchor, ${_}nodes, ${_}values, ${values}, $, ${_}createFor);\n`;
  $.update += `xm.updateNodes(${_}anchor.parentNode, ${_}anchor, ${_}nodes, ${_}values, ${values}, $, ${_}createFor);\n`;
}

export function compile(name, template) {
  const vnode = {node: "_node", properties: {}, children: parse(template)},
        $ = {html: "", create: "", update: ""};
  generateChildren(vnode, $);
  return `xm.register("${name}", \`${$.html.replaceAll("`", "\\`")}\`, function(_node, slot, $, props) {
    ${$.create}
    return (props) => {
      ${$.update}
    };
  });\n`;
}

function generateClosure(vnode, $, _, beforeCreate = "", beforeUpdate = "") {
  const $$ = {create: "", update: "", html: ""}, node = generateNodeName($, vnode, "closure");
  generateVnode(vnode, $$);
  $.html += "<!---->";
  $.create += `let ${_}anchor = ${node}, ${_}node = xm.fragment(\`${$$.html.replaceAll("`", "\\`")}\`).firstChild;
               function ${_}create($, ..._args) {
                 let ${node} = ${_}node.cloneNode(true);
                 ${beforeCreate}
                 ${$$.create}
                 return [${node}, (..._args) => {
                   ${beforeUpdate}
                   ${$$.update}
                 }];
               }\n`;
}

export function generateVnode(vnode, $) {
  for (const [predicate, macro] of macros) {
    const kv = Object.entries(vnode.properties).find(([k]) => predicate.test(k));
    if (kv) {
      delete vnode.properties[kv[0]];
      return void macro(vnode, $, ...kv);
    }
  }
  generateNodeName($, vnode, "vnode");
  const [tag, rawTag, isDynamicTag] = parseValue(vnode.tag);
  if (!isDynamicTag && !isComponentTag(rawTag)) {
    $.html += `<${rawTag}`;
    generateProperties(vnode, $);
    $.html += ">";
    if (vnode.void) return;
    generateChildren(vnode, $);
    $.html += `</${rawTag}>`;
  } else if (isComponentTag(rawTag)) {
    $.html += `<${rawTag}>`;
    generateChildren(vnode, $);
    $.html += `</${rawTag}>`;
    const properties = Object.entries(vnode.properties).reduce((out, [k, v]) =>
      `${out}[${parseValue(k)[0]}]: ${parseValue(v)[0]}, `, "{ ") + "}";
    $.create += `${vnode.node}._props = ${properties}, ${vnode.node}._$ = Object.create($);\n`;
    $.update += `${vnode.node}._props = ${properties};
                 ${vnode.node}.updateCallback();\n`;
  } else {
    throw new Error("dynamic tags are currently not supported");
  }
}

function generateProperties(vnode, $) {
  const dynamicProperties = [];
  for (const k in vnode.properties) {
    const [key, rawKey, isDynamicKey] = parseValue(k),
          [value, rawValue, isDynamicValue] = parseValue(vnode.properties[k]);
    if (!isDynamicKey && !isDynamicValue) $.html += ` ${rawKey}=${value}`;
    else dynamicProperties.push({key, value, isDynamicKey, isDynamicValue});
  }
  if (!dynamicProperties.length) return;
  const node = generateLocalNodeName($, vnode, "properties");
  for (let {key, value, isDynamicKey, isDynamicValue} of dynamicProperties) {
    if (!isDynamicKey) {
      $.create += `xm.setProperty(${node}, ${key}, ${value});\n`;
      $.update += `xm.setProperty(${node}, ${key}, ${value});\n`;
    } else {
      const _ = prefix("properties");
      $.create += `let ${_}key = ${key}; xm.setProperty(${node}, ${_}key, ${value});\n`;
      $.update += `${_}key = xm.setDynamicKeyProperty(${node}, ${_}key, ${key}, ${value});\n`;
    }
  }
}

function generateChildren(vnode, $) {
  let node = vnode.node + ".firstChild", dynamicChildren = [];
  for (const vchild of vnode.children) {
    node = generateNodeName($, {node}, "children");
    if (vchild.tag) {
      vchild.node = node;
      generateVnode(vchild, $);
      node = vchild.node;
      node = node + ".nextSibling";
    } else {
      for (let [value, rawValue, isDynamic] of parseValueParts(vchild)[0]) {
        $.html += isDynamic ? "<!---->" : rawValue;
        if (isDynamic) dynamicChildren.push([node, value]);
        node = node + ".nextSibling";
      }
    }
  }
  if (dynamicChildren.length) {
    const _ = prefix("children"), values = dynamicChildren.map(([_, v]) => v), nodes = dynamicChildren.map(([n]) => n),
          node = generateLocalNodeName($, vnode, "children");

    $.create += `const ${_}nodes = [${nodes}], ${_}values = [];
                 xm.updateNodes(${node}, null, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
    $.update += `xm.updateNodes(${node}, null, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
  }
}

function isComponentTag(tag) {
  return tag && tag.startsWith("x-");
}

function generateNodeName($, vnode, key = "") {
  if (vnode.node.indexOf(".") === -1) return vnode.node;
  return vnode.node = generateLocalNodeName($, vnode, key);
}

function generateLocalNodeName($, vnode, key = "") {
  const _ = prefix(key);
  $.create += `let ${_}node = ${vnode.node};\n`;
  return `${_}node`;
}

export const resetPrefixId = () => prefixId = 0;
const prefix = (key) => `_${key}_${prefixId++}_`;
let prefixId = 0
