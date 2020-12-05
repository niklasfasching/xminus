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
  const node = generateLocalNodeName($, vnode);
  $.create += `${node}.addEventListener("keyup", ({target}) => ${value} = target.value);\n`;
  $.update += `if (document.activeElement !== ${node}) ${node}["${property}"] = ${value};\n`;
}

function onMacro(vnode, $, key, value) {
  generateVnode(vnode, $);
  const event = key.split(":")[1];
  if (event === "update" || event === "create") {
    $[event] += `setTimeout(() => {
                   let target = ${generateLocalNodeName($, vnode)};
                   ${value}
                 })\n`;
  } else {
    $.create += `${vnode.node}.addEventListener("${event}", (event) => {
                 ${value};
                 $update();
               });\n`;
  }
}

function ifMacro(vnode, $, key, value) {
  generateNodeName($, vnode);
  generateVnode(vnode, $);
  const _ = prefix();
  $.create += `const ${_}node = ${vnode.node}, ${_}placeholder = document.createComment("if");
               if (!${value}) ${vnode.node} = xm.replaceWith(${_}node, ${_}placeholder);\n`;
  $.update += `xm.nodeIf((${value}), ${_}node, ${_}placeholder);\n`
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

export async function compile(url, asDataUrl) {
  const modules = await loadModule(url);
  if (asDataUrl) {
    const imports = modules.slice(1)
          .map(m => `//# sourceURL=${new URL(m.url).pathname}.js\n${m.code}`)
          .concat(`//# sourceURL=xmComponents.js\n${generateComponents(modules)}`)
          .map(src => `import "${dataUrl(src)}";`);
    return dataUrl(imports.join("\n"));
  }
  const document = modules[0].document;
  const scripts = modules.map(m => m.code).concat(generateComponents(modules)).map(code => {
    return `<script type=module>\n${code}</script>`;
  }).join("\n");
  document.head.innerHTML = "\n" + scripts + document.head.innerHTML;
  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
}

function generateComponents(modules) {
  return modules
    .flatMap(({componentTemplates}) => componentTemplates)
    .map(({name, content}) => generateComponent(name, content))
    .join("\n");
}

export async function loadModule(url, loaded = {}) {
  if (loaded[url]) return [];
  loaded[url] = true;
  const document = url === location ? window.document : await loadDocument(url);
  const templates = [...document.querySelectorAll(`[type*=x-template][id]`)],
        imports = [...document.querySelectorAll(`[type*=x-module][src]`)],
        scripts = [...document.querySelectorAll(`[type*=module]:not([src])`)];
  if (url !== location) [templates, imports, scripts].flat().forEach(el => el.remove());
  if (scripts.length > 1) throw new Error(`One module per file - found ${scripts.length}`);
  const modules = await Promise.all(imports.map(({src}) => loadModule(resolveUrl(src, url), loaded))),
        code = rewriteRelativeImports((scripts[0]?.text || "")),
        componentTemplates = templates.map(({id, text}) => ({name: id, content: text}));
  return [{url: resolveUrl(url), document, code, componentTemplates}, ...modules.flat()];
}

export function generateComponent(name, template) {
  const vnode = {node: "_node", properties: {}, children: parse(template)},
        $ = {html: "", create: "", update: ""};
  generateChildren(vnode, $);
  return `xm.components["${name}"] = (function() {
            const _hooks = xm.hooks["${name}"] || {};
            const _template = document.createElement("template");
            _template.innerHTML = \`${$.html.replaceAll("`", "\\`")}\`;
            return function($, properties, _createChildren, $update) {
              const _node = _template.content.cloneNode(true);
              if (!$update) $update = () => _update($);
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
              return [new xm.Fragment(_node.childNodes), _update];
            };
          })();\n`;
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
                 const ${_}closureNode = ${vnode.tag === "template" ? `new xm.Fragment(${node}.content.childNodes)` : node};
                 ${_}closureNode.update = (..._args) => {
                   ${beforeUpdate}
                   ${$$.update}
                   return ${_}closureNode;
                 };
                 return ${_}closureNode;
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
    $.create += `const [${_}component, ${_}update] = xm.components["${rawTag}"]($, ${properties}, ${_}create, $update);
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
  const node = generateLocalNodeName($, vnode, true);
  for (let {key, value, isDynamicKey, isDynamicValue} of dynamicProperties) {
    if (!isDynamicKey) {
      $.create += `xm.setProperty(${node}, ${key}, ${value});\n`;
      $.update += `xm.setProperty(${node}, ${key}, ${value});\n`;
    } else {
      const _ = prefix();
      $.create += `let ${_}key = ${key}; xm.setProperty(${node}, ${_}key, ${value});\n`;
      $.update += `${_}key = xm.setDynamicKeyProperty(${node}, ${_}key, ${key}, ${value});\n`;
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
    const _ = prefix(), values = dynamicChildren.map(([_, v]) => v), nodes = dynamicChildren.map(([n]) => n),
          node = generateLocalNodeName($, vnode);

    $.create += `const ${_}nodes = [${nodes}], ${_}values = [], ${_}anchor = ${nodes[0]}.previousSibling;
                 xm.updateNodes(${node}, ${_}anchor, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
    $.update += `xm.updateNodes(${node}, ${_}anchor, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
  }
}

function isComponentTag(tag) {
  return tag.startsWith("x-");
}

function generateNodeName($, vnode) {
  if (vnode.node.indexOf(".") === -1) return vnode.node;
  return vnode.node = generateLocalNodeName($, vnode);
}

function generateLocalNodeName($, vnode) {
  const _ = prefix();
  $.create += `let ${_}node = ${vnode.node};\n`;
  return `${_}node`;
}

function dataUrl(string) {
  return `data:text/javascript,${encodeURIComponent(string)}`;
}

function rewriteRelativeImports(script, baseUrl) {
  return script.replaceAll(/^\s*(import\s+(.*from\s+)?)["'](.+)["']/g,
                         (_, from, __, src) => `${from} "${resolveUrl(src, baseUrl)}"`);
}

function resolveUrl(url, baseUrl) {
  if (!baseUrl) baseUrl = location;
  else if (baseUrl.toString().startsWith("data:")) return url;
  return new URL(url, new URL(baseUrl, location)).pathname;
}

function loadDocument(url) {
  return fetch(url).then(async (r) => new DOMParser().parseFromString(await r.text(), "text/html"));
}

export const resetPrefixId = () => prefixId = 0;
const prefix = () => `_${prefixId++}_`;
let prefixId = 0;
