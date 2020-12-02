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
  const module =  modules.map(m => `import "${generateModule(m, true)}";\n`).join("\n");
  if (asDataUrl) return dataUrl(module);
  const document = modules[0].document;
  document.head.innerHTML = `<script type="module">${module}</script>\n` + document.head.innerHTML;
  return new XMLSerializer().serializeToString(document);
}

function generateModule({url, code, templates}, asDataUrl) {
  const module = templates.reduce((module, {name, content}) => {
    return module + `xm.components["${name}"] = ${generateComponent(name, content)};\n`;
  }, `//# sourceURL=${new URL(url).pathname}.compiled.js\n${code}\n`);
  return asDataUrl ? dataUrl(module) : module;
}

export async function loadModule(url, loaded = {}) {
  if (loaded[url]) return [];
  loaded[url] = true;
  const d = url === location ? document : await loadDocument(url);
  const templates = [...d.querySelectorAll(`[type*=x-template][id]`)],
        imports = [...d.querySelectorAll(`[type*=x-module][src]`)],
        scripts = [...d.querySelectorAll(`[type*=x-module]:not([src])`)];
  [templates, imports, scripts].flat().forEach(el => el.remove());
  if (scripts.length > 1) throw new Error(`One x-module per file - found ${scripts.length}`);
  const code = (scripts[0]?.text || "").replaceAll(/^\s*(import\s+(.*from\s+)?)["'](.+)["']/g,
                                                   (_, from, __, src) => `${from} "${resolveUrl(src, url)}"`)
  const modules = await Promise.all(imports.map(({src}) => loadModule(resolveUrl(src, url), loaded)));
  const module = {
    url: resolveUrl(url),
    document: d,
    code,
    templates: templates.map(({id, text}) => ({name: id, content: text})),
  };
  return [module, ...modules.flat()];
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
            return function _${name}Component($, properties, _createChildren, $update) {
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
      $.create += `let ${_}key = ${key}; setProperty(${node}, ${_}key, ${value});\n`;
      $.update += `let ${_}updatedKey = ${key};
                   if (${_}key !== ${_}updatedKey) xm.setProperty(${node}, ${_}key, undefined);
                   xm.setProperty(${node}, ${_}updatedKey, ${value});
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

export function resetPrefixId() {
  prefixId = 0;
}

function dataUrl(string) {
  return `data:text/javascript,${encodeURIComponent(string)}`;
}

function resolveUrl(url, baseUrl) {
  if (!baseUrl || baseUrl.toString().startsWith("data:text")) baseUrl = location;
  return new URL(url, new URL(baseUrl, location));
}

function loadDocument(url) {
  return fetch(url).then(async (r) => new DOMParser().parseFromString(await r.text(), "text/html"));
}
