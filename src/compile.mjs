// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
const voidTags = {area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1},
      prefix = () => `_${prefixId++}_`;
let prefixId = 0;

export const components = {};

const macros = [
  [/^\.for$/, forMacro],
  [/^\.on:/, onMacro],
];

export function setProperty(node, k, v) {
  if (k in node && k !== "list" && k !== "form" && k !== "selected") node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v);
}

export function updateFor(reference, nodeGroups, values, create, $) {
  const group = ([node, update]) => Object.assign(node instanceof DocumentFragment ? [...node.childNodes] : [node],
                                                  {update});
  updateNodeGroups(reference, nodeGroups, values, value => group(create($, value)));
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
  parentNode.appendChild(components[name]($, {}));
}

function onMacro(vnode, $, key, value) {
  generateVnode(vnode, $);
  $.create += `${vnode.node}.addEventListener("${key.split(":")[1]}", (event) => {
                 ${value};
                 $update();
               });\n`;
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

async function generateCode(url) {
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
  const vnode = {node: "_node", properties: {}, children: compile(template)},
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
              const $update = () => _node._update($);
              $ = Object.create($);
              $ = Object.assign($, _hooks.create?.($, properties, $update));
              const _childrenTemplate = _createChildren?.($);
              const children = _childrenTemplate?.content;
              ${$.create}
              _node._update = ($, _properties) => {
                if (_properties) properties = _properties;
                _hooks.update?.($, properties, $update);
                _childrenTemplate?._updateClosure();
                ${$.update}
              }
              return _node;
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
                 return [${node}, (..._args) => {
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

  const [tag, rawTag, isDynamicTag] = compileValue(vnode.tag);
  if (!isDynamicTag && !isComponentTag(rawTag)) {
    $.html += `<${rawTag}`;
    if (Object.entries(vnode.properties).some(([k, v]) => compileValue(k)[2] || compileValue(v)[2])) {
      vnode.node = generateNodeName($, vnode.node);
    }
    generateProperties(vnode, $);
    $.html += ">";
    if (voidTags[tag]) return;
    generateChildren(vnode, $);
    $.html += `</${rawTag}>`;
  } else if (isComponentTag(rawTag) && !isDynamicTag) {
    vnode.node = generateNodeName($, vnode.node);
    const _ = prefix(),
          properties = Object.entries(vnode.properties).reduce((out, [k, v]) =>
            `${out}[${compileValue(k)[0]}]: ${compileValue(v)[0]}, `, "{ ") + "}";
    generateClosure(Object.assign({}, vnode, {tag: "template", properties: {}}), $, _);
    $.create += `const ${_}component = components["${rawTag}"]($, ${properties}, ${_}create);
                 ${_}parent.appendChild(${_}component);\n`;
    $.update += `${_}component._update($, ${properties});\n`;
  } else {
    throw new Error("not impemented: dynamic tags");
  }
}

function generateProperties(vnode, $) {
  for (const k in vnode.properties) {
    const [key, rawKey, isDynamicKey] = compileValue(k),
          [value, rawValue, isDynamicValue] = compileValue(vnode.properties[k]);
    if (!isDynamicKey && !isDynamicValue) $.html += ` ${rawKey}=${value}`;
    else if (!isDynamicKey) {
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

export function generateChildren(vnode, $) {
  let node = vnode.node + ".firstChild";
  if (!vnode.parent) node = generateNodeName($, node);
  for (const vchild of vnode.children) {
    if (vchild.tag) {
      vchild.node = node;
      generateVnode(vchild, $);
      node = vchild.node;
    } else {
      const [value, rawValue, isDynamic] = compileValue(vchild);
      if (!isDynamic) $.html += vchild;
      else {
        const _ = prefix();
        node = generateNodeName($, node);
        $.html += value;
        $.create += `let ${_}text = ${value}; ${node}.nodeValue = ${_}text;\n`;
        $.update += `let ${_}updatedText = ${value};
                     if (${_}text !== ${_}updatedText) ${node}.nodeValue = ${_}updatedText;
                     ${_}text = ${_}updatedText;\n`;
      }
    }
    node = node + ".nextSibling";
  }
}

function generateNodeName($, name) {
  if (name.indexOf(".") === -1) return name;
  const _ = prefix();
  $.create += `let ${_}node = ${name};\n`;
  return `${_}node`;
}

function compileValue(input) {
  const [parts, isDynamic] = parseValue(input);
  return [parts.length === 1 ? parts[0][0] : parts.map(p => p[0]).join(" + "),
          isDynamic ?  null : parts[0][1],
          isDynamic];
}

function parseValue(input) {
  let parts = [], part = "", lvl = 0, push = () => {
    if (part) part && parts.push([lvl === 1 ? `(${part})` : `"${part}"`, part, lvl === 1]);
    part = "";
  };
  for (let c of input) {
    if (c === "{" && lvl === 0) push(), lvl++;
    else if (c === "}" && lvl === 1) push(), lvl--;
    else part +=c;
  }
  push();
  return [parts, parts.some(p => p[2])];
}

export function compile(template) {
  const tokens = lex(template), vnodes = [], parents = [];
  for (let i = 0, [$, x] = tokens[0]; i < tokens.length; i++, [$, x] = tokens[i] || []) {
    if ($ === "open") {
      const vchild = {tag: x, properties: {}, children: [], parent: parents[0]};
      (parents[0]?.children || vnodes).push(vchild);
      parents.unshift(vchild);
    } else if ($ === "close") {
      parents.shift();
    } else if ($ === "child") {
      (parents[0]?.children || vnodes).push(x);
    } else if ($ === "key") {
      parents[0].properties[x] = tokens[++i][1];
    } else throw "unexpected: " + $;
  }
  if (parents.length) throw new Error(`unclosed ${parents[0].tag}: ${template}`);
  return vnodes;
}

export function lex(template) {
  let $ = "child", tag = "", tmp = "", tokens = [], push = ($next) => {
    if (tmp.trim()) tokens.push([$, tmp]);
    if ($ === "open") tag = tmp;
    $ = $next, tmp = "";
  };
  for (let i = 0, c = template[0]; i < template.length; i++, c = template[i]) {
    if ($ === "child" && c === "<") {
      push(template[i+1] === "/" ? "close" : "open");
    } else if ($ !== "child" && (c === ">" || c === "/" && template[i+1] === ">")) {
      push("child");
      if (c === "/") i++;
      if (c === "/" || voidTags[tag]) tokens.push(["close", "/"]);
    } else if ($ !== "child" && (c === " " || c === "\n")) {
      push("key");
      if (tokens[tokens.length-1][0] === "key") tokens.push(["value", "true"]);
    } else if ($ === "value" && (c === "'" || c === '"')) {
      while (template[++i] !== c) tmp += template[i];
      tmp = tmp || "true";
      push("key");
    } else if ($ === "key" && c === "=") {
      push("value");
    } else {
      tmp += c;
    }
  }
  push();
  return tokens;
}
