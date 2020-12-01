import {parse, parseValue, parseValueParts} from "./parser.mjs";

const prefix = () => `_${prefixId++}_`;
let prefixId = 0;

const macros = [
  [/^\.if$/, ifMacro],
  [/^\.for$/, forMacro],
  [/^\.on:/, onMacro],
];

function onMacro(vnode, $, key, value) {
  generateVnode(vnode, $);
  $.create += `${vnode.node}.addEventListener("${key.split(":")[1]}", (event) => {
                 ${value};
                 $update();
               });\n`;
}

function ifMacro(vnode, $, key, value) {
  generateNodeName($, vnode);
  generateVnode(vnode, $);
  const _ = prefix();
  $.create += `const ${_}node = ${vnode.node}, ${_}placeholder = document.createComment("if");
               ${vnode.node} = xm.nodeIf((${value}), ${_}node, ${_}placeholder);\n`;
  $.update += `${vnode.node} = xm.nodeIf((${value}), ${_}node, ${_}placeholder);\n`
}

function forMacro(vnode, $, key, value) {
  if (!vnode.parent || vnode.parent.children.length > 1) throw new Error("for: must be only child node");
  const _ = prefix(),
        [name, inOrOf, values] = value.split(/ (of|in) /);
  generateClosure(vnode, $, _,
                  `$ = Object.assign(Object.create($), {"${name}": _args[0]});`,
                  `$["${name}"] = _args[0];`);
  $.create += `const ${_}values = [], ${_}nodes = [];
               xm.updateNodes(${_}parent, ${_}anchor, ${_}nodes, ${_}values, ${values}, $, ${_}create);\n`;
  $.update += `xm.updateNodes(${_}parent, ${_}anchor, ${_}nodes, ${_}values, ${values}, $, ${_}create);\n`;
}

export async function compile(url) {
  let code = `//# sourceURL=${url}.compiled.js\n`, d = document;
  if (url !== location.toString()) {
    d = await fetch(url).then(r => r.text()).then(html => new DOMParser().parseFromString(html, "text/html"));
    const scripts = d.querySelectorAll(`script[type="module"]`);
    if (scripts.length !== 1) throw new Error(`components must have one module script tag: ${url}`);
    code += scripts[0].text.replaceAll(/^\s*(import.*from) ["'](.+)["']/g, (_, importFrom, importURL) =>
      `${importFrom} "${new URL(importURL, new URL(url, location))}"`) + "\n";
  }

  d.querySelectorAll(`script[type="text/x-template"][id^=x-]`).forEach(({id, text}) => {
    code += `xm.components["${id}"] = ${generateComponent(id, text)}`;
  });
  return code;
}

export function generateComponent(name, template) {
  const vnode = {node: "_node", properties: {}, children: parse(template)},
        $ = {html: "", create: "", update: ""};
  name = name.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  generateChildren(vnode, $);
  return `(function() {
            const _hooks = typeof ${name} === "undefined" ? {} : ${name};
            const _template = document.createElement("template");
            _template.innerHTML = \`${$.html.replaceAll("`", "\\`")}\`;
            return function _${name}Component($, properties, _createChildren) {
              const _node = _template.content.cloneNode(true);
              const $update = () => _update($);
              $ = Object.create($);
              $ = Object.assign($, _hooks.create?.($, properties, $update));
              const children = _createChildren?.($);
              ${$.create}
              const _update = ($, _properties) => {
                if (_properties) properties = _properties;
                _hooks.update?.($, properties, $update);
                children?.update();
                ${$.update}
              };
              return [new xm.Fragment([..._node.childNodes]), _update];
            };
          })()\n`;
}

function generateClosure(vnode, $, _, beforeCreate = "", beforeUpdate = "") {
  const $$ = {create: "", update: "", html: ""},
        node = generateNodeName($, vnode);
  generateVnode(vnode, $$);
  $.html += $$.html;
  $.create += `let ${_}node = ${node}, ${_}parent = ${node}.parentNode, ${_}anchor = document.createComment("closure anchor");
               ${_}node.replaceWith(${_}anchor);
               ${node} = ${_}anchor;
               function ${_}create($, ..._args) {
                 let ${node} = ${_}node.cloneNode(true);
                 ${beforeCreate}
                 ${$$.create}
                 const ${_}closureNode = ${vnode.tag === "template" ? `new xm.Fragment([...${node}.content.childNodes])` : node};
                 ${_}closureNode.update = (..._args) => {
                   ${beforeUpdate}
                   ${$$.update}
                   return ${_}closureNode;
                 };
                 return ${_}closureNode;
               }\n`;
}

function isComponentTag(tag) { return tag.startsWith("x-"); }

export function generateVnode(vnode, $) {
  for (const [predicate, macro] of macros) {
    const kv = Object.entries(vnode.properties).find(([k]) => predicate.test(k));
    if (kv) {
      delete vnode.properties[kv[0]];
      return void macro(vnode, $, ...kv);
    }
  }
  generateNodeName($, vnode);
  const [tag, rawTag, isDynamicTag] = parseValue(vnode.tag);
  if (!isDynamicTag && !isComponentTag(rawTag)) {
    $.html += `<${rawTag}`;
    generateProperties(vnode, $);
    $.html += ">";
    if (vnode.void) return;
    generateChildren(vnode, $);
    $.html += `</${rawTag}>`;
  } else if (isComponentTag(rawTag) && !isDynamicTag) {
    const _ = prefix(),
          properties = Object.entries(vnode.properties).reduce((out, [k, v]) =>
            `${out}[${parseValue(k)[0]}]: ${parseValue(v)[0]}, `, "{ ") + "}";
    generateClosure(Object.assign({}, vnode, {tag: "template", properties: {}}), $, _);
    $.html += "<!---->";
    $.create += `const [${_}component, ${_}update] = xm.components["${rawTag}"]($, ${properties}, ${_}create);
                 ${vnode.node}.replaceWith(${_}component);
                 ${vnode.node} = ${_}component;\n`;
    $.update += `${_}update($, ${properties});\n`;
  } else {
    throw new Error("not impemented: dynamic tags");
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
  generateNodeName($, vnode, true);
  for (let {key, value, isDynamicKey, isDynamicValue} of dynamicProperties) {
    if (!isDynamicKey) {
      $.create += `xm.setProperty(${vnode.node}, ${key}, ${value});\n`;
      $.update += `xm.setProperty(${vnode.node}, ${key}, ${value});\n`;
    } else {
      const _ = prefix();
      $.create += `let ${_}key = ${key}; setProperty(${vnode.node}, ${_}key, ${value});\n`;
      $.update += `let ${_}updatedKey = ${key};
                   if (${_}key !== ${_}updatedKey) xm.setProperty(${vnode.node}, ${_}key, undefined);
                   xm.setProperty(${vnode.node}, ${_}updatedKey, ${value});
                   ${_}key = ${_}updatedKey;\n`;
    }
  }
}

function generateChildren(vnode, $) {
  let node = vnode.node + ".firstChild", dynamicChildren = [];
  for (const vchild of vnode.children) {
    node = generateNodeName($, {node});
    if (vchild.tag) {
      vchild.node = node;
      generateVnode(vchild, $);
      node = vchild.node;
    } else {
      for (let [value, rawValue, isDynamic] of parseValueParts(vchild)[0]) {
        $.html += isDynamic ? "<!---->" : rawValue;
        if (isDynamic) dynamicChildren.push([node, value]);
      }
    }
    node = node + ".nextSibling";
  }
  if (dynamicChildren.length) {
    const _ = prefix(), values = dynamicChildren.map(([_, v]) => v), nodes = dynamicChildren.map(([n]) => n);
    $.create += `const ${_}node = ${vnode.node}, ${_}nodes = [${nodes}], ${_}values = [],
                       ${_}anchor = ${nodes[0]}.previousSibling;
                 xm.updateNodes(${_}node, ${_}anchor, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
    $.update += `xm.updateNodes(${_}node, ${_}anchor, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
  }
}


function generateNodeName($, vnode, force) {
  if (vnode.node.indexOf(".") === -1 && !force) return vnode.node;
  const _ = prefix();
  $.create += `let ${_}node = ${vnode.node};\n`;
  return vnode.node = `${_}node`;
}

export function resetPrefixId() { prefixId = 0 }
