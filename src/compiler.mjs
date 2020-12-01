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
  vnode.node = generateNodeName($, vnode.node);
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
  $.create += `let ${_}reference = ${_}parent.appendChild(document.createComment("for")),
                   ${_}nodeGroups = [];
               xm.updateFor(${_}reference, ${_}nodeGroups, ${values}, ${_}create, $);\n`;
  $.update += `xm.updateFor(${_}reference, ${_}nodeGroups, ${values}, ${_}create, $);\n`;
}

export async function generateCode(url) {
  let code = `//# sourceURL=${url}.generated.js\n`, d = document;
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
  name = name.slice(2);
  generateChildren(vnode, $);
  return `(function() {
            //# sourceURL=${name}Component.generated.js
            const _hooks = typeof ${name} === "undefined" ? {} : ${name};
            const _template = document.createElement("template");
            _template.innerHTML = \`${$.html.replaceAll("`", "\\`")}\`;
            return function _${name}Component($, properties, _createChildren) {
              const _node = _template.content.cloneNode(true);
              const $update = () => _update($);
              $ = Object.create($);
              $ = Object.assign($, _hooks.create?.($, properties, $update));
              const [children, _updateChildren] = _createChildren?.($) || [];
              ${$.create}
              const _update = ($, _properties) => {
                if (_properties) properties = _properties;
                _hooks.update?.($, properties, $update);
                _updateChildren?.();
                ${$.update}
              };
              return [[..._node.childNodes], _update];
            };
          })()\n`;
}

function generateClosure(vnode, $, _, beforeCreate = "", beforeUpdate = "") {
  const $$ = {create: "", update: "", html: ""},
        node = vnode.node = generateNodeName($, vnode.node);
  generateVnode(vnode, $$);
  $.html += $$.html;
  $.create += `let ${_}template = ${node}, ${_}parent = ${node}.parentNode;
               ${_}parent.removeChild(${node});
               function ${_}create($, ..._args) {
                 let ${node} = ${_}template.cloneNode(true);
                 ${beforeCreate}
                 ${$$.create}
                 return [[${vnode.tag === "template" ? `...${node}.content.childNodes` : node}], (..._args) => {
                   ${beforeUpdate}
                   ${$$.update}
                 }];
               };\n`;
}

function isComponentTag(tag) { return tag.startsWith("x-"); }

function generateVnode(vnode, $) {
  for (const [predicate, macro] of macros) {
    const kv = Object.entries(vnode.properties).find(([k]) => predicate.test(k));
    if (kv) {
      delete vnode.properties[kv[0]];
      return void macro(vnode, $, ...kv);
    }
  }

  const [tag, rawTag, isDynamicTag] = parseValue(vnode.tag);
  if (!isDynamicTag && !isComponentTag(rawTag)) {
    $.html += `<${rawTag}`;
    if (Object.entries(vnode.properties).some(([k, v]) => parseValue(k)[2] || parseValue(v)[2])) {
      vnode.node = generateNodeName($, vnode.node);
    }
    generateProperties(vnode, $);
    $.html += ">";
    if (vnode.void) return;
    generateChildren(vnode, $);
    $.html += `</${rawTag}>`;
  } else if (isComponentTag(rawTag) && !isDynamicTag) {
    vnode.node = generateNodeName($, vnode.node);
    const _ = prefix(),
          properties = Object.entries(vnode.properties).reduce((out, [k, v]) =>
            `${out}[${parseValue(k)[0]}]: ${parseValue(v)[0]}, `, "{ ") + "}";
    generateClosure(Object.assign({}, vnode, {tag: "template", properties: {}}), $, _);
    $.create += `const [${_}nodes, ${_}update] = xm.components["${rawTag}"]($, ${properties}, ${_}create);
                 for (let node of ${_}nodes) ${_}parent.appendChild(node);\n`;
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
  const node = `${prefix()}node`;
  $.create += `const ${node} = ${vnode.node};\n`
  for (let {key, value, isDynamicKey, isDynamicValue} of dynamicProperties) {
    if (!isDynamicKey) {
      $.create += `xm.setProperty(${node}, ${key}, ${value});\n`;
      $.update += `xm.setProperty(${node}, ${key}, ${value});\n`;
    } else {
      const _ = prefix();
      $.create += `let ${_}key = ${key}; setProperty(${node}, ${_}key, ${value});\n`;
      $.update += `let ${_}updatedKey = ${key};
                   if (${_}key !== ${_}updatedKey) xm.setProperty(${node}, ${_}key, undefined);
                   xm.setProperty(${node}, ${_}updatedKey, ${value});
                   ${_}key = ${_}updatedKey;\n`;
    }
  }
}

export function generateChildren(vnode, $) {
  let node = vnode.node + ".firstChild", dynamicChildren = [];
  if (!vnode.parent) node = generateNodeName($, node);
  for (const vchild of vnode.children) {
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
    $.create += `const ${_}node = ${vnode.node}, ${_}nodeGroups = [${values}].map(v => xm.createNodeGroup(v));
                 [${nodes}].forEach((placeholder, i) => {
                    for (let node of ${_}nodeGroups[i]) ${_}node.insertBefore(node, placeholder);
                    ${_}node.removeChild(placeholder);
                 });\n`;
    $.update += `xm.updateNodeGroups(${_}node.firstChild, ${_}nodeGroups, [${values}], xm.createChild);\n`;
  }
}

function generateNodeName($, name) {
  if (name.indexOf(".") === -1) return name;
  const _ = prefix();
  $.create += `let ${_}node = ${name};\n`;
  return `${_}node`;
}
