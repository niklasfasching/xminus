// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
const voidTags = {area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1},
      prefix = () => `_${prefixId++}_`;
let prefixId = 0;

const components = {},
      macros = [
        [/^\.for$/, forMacro],
        [/^\.on:/, onMacro],
      ];

window.setProperty = function setProperty(node, k, v) {
  if (k in node && k !== "list" && k !== "form" && k !== "selected") node[k] = v == null ? "" : v;
  else if (v == null || v === false) node.removeAttribute(k);
  else node.setAttribute(k, v);
}

window.updateFor = function updateFor(parentNode, $, values, create) {
  const childNodes = [...parentNode.childNodes];
  for (let i = 0, j = 0; i < childNodes.length || j < values.length; i++, j++) {
    let node = childNodes[i], value = values[j];
    if (node && j < values.length) node._updateClosure($, value);
    else if (node) parentNode.removeChild(node);
    else create($, value);
  }
}

export async function mount(parentNode, name, $) {
  document.querySelectorAll(`script[type="text/x-template"][name]`).forEach(template => {
    const name = template.getAttribute("name");
    components[name] = eval(generateComponent(name, template.text));
  });
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
        [name, inOrOf, values] = value.split(/ (of|in) /),
        $$ = {create: "", update: "", html: ""},
        node = vnode.node = generateNodeName($, vnode.node);
  generateVnode(vnode, $$);
  $.html += $$.html;
  $.create += `let ${_}forParent = ${node}.parentNode, ${_}forNode = ${node};
               ${_}forParent.removeChild(${_}forNode);
               function ${_}create($, ${_}value) {
                 $ = Object.assign(Object.create($), {"${name}": ${_}value});
                 let ${node} = ${_}forNode.cloneNode(true);
                 ${$$.create}
                 ${node}._update = ($, ${_}value) => {
                   $["${name}"] = ${_}value;
                   ${$$.update}
                 };
                 ${_}forParent.appendChild(${node});
               }
               for (let value of ${values}) ${_}create($, value);\n`;
  $.update += `updateFor(${_}forParent, $, ${values}, ${_}create);\n`
  function updateItems(forParent, create) {

  }
}

export function generateComponent(name, template) {
  const vnode = {node: "_node", properties: {}, children: compile(template)},
        $ = {html: "", create: "", update: ""};
  generateChildren(vnode, $)
  return `(function() {
            //# sourceURL=${name}Component.generated.js
            const _hooks = typeof ${name} === "undefined" ? {} : ${name};
            const _template = document.createElement("template");
            _template.innerHTML = \`${$.html.replaceAll("`", "\\`")}\`;
            return function _${name}Component($, properties) {
              const _node = _template.content.cloneNode(true);
              const $update = () => _node._update($);
              $ = Object.create($);
              $ = Object.assign($, _hooks.create?.($, properties, $update));
              ${$.create}
              _node._update = ($, _properties) => {
                if (_properties) properties = _properties;
                _hooks.update?.($, properties, $update);
                ${$.update}
              }
              return _node;
            };
          })()\n`;
}

function isComponentTag(tag) { return tag.startsWith("x-"); }

function generateVnode(vnode, $) {
  for (const [predicate, macro] of macros) {
    const kv = Object.entries(vnode.properties).find(([k]) => predicate.test(k));
    if (kv) {
      delete vnode.properties[kv[0]];
      return macro(vnode, $, ...kv);
    }
  }

  const [tag, rawTag, isDynamicTag] = compileValue(vnode.tag);
  if (!isDynamicTag && !isComponentTag(tag)) {
    $.html += `<${rawTag}`;
    if (Object.entries(vnode.properties).some(([k, v]) => compileValue(k)[2] || compileValue(v)[2])) {
      vnode.node = generateNodeName($, vnode.node);
    }
    generateProperties(vnode, $);
    $.html += ">";
    if (voidTags[tag]) return;
    generateChildren(vnode, $);
    $.html += `</${rawTag}>`
  } else {
    throw new Error("not impemented: dynamic/component tag");
  }
}

function generateProperties(vnode, $) {
  for (const k in vnode.properties) {
    const [key, rawKey, isDynamicKey] = compileValue(k),
          [value, rawValue, isDynamicValue] = compileValue(vnode.properties[k]);
    if (!isDynamicKey && !isDynamicValue) $.html += ` ${rawKey}=${rawValue}`;
    else if (!isDynamicKey) {
      $.create += `setProperty(${vnode.node}, ${key}, ${value});\n`;
      $.update += `setProperty(${vnode.node}, ${key}, ${value});\n`;
    } else {
      const _ = prefix();
      $.create += `let ${_}key = ${key}; setProperty(${vnode.node}, ${_}key, ${value});\n`;
      $.update += `let ${_}updatedKey = ${key};
                   if (${_}key !== ${_}updatedKey) setProperty(${vnode.node}, ${_}key, undefined);
                   setProperty(${vnode.node}, ${_}updatedKey, ${value});
                   ${_}key = ${_}updatedKey;\n`;
    }
  }
}

function generateChildren(vnode, $) {
  let node = vnode.node + ".firstChild";
  if (!vnode.parent) node = generateNodeName($, node);
  for (const vchild of vnode.children) {
    if (!vchild.tag) {
      const [value, rawValue, isDynamic] = compileValue(vchild);
      if (!isDynamic) $.html += vchild;
      else {
        const _ = prefix();
        node = generateNodeName($, node);
        $.html += value;
        $.create += `let ${_}text = ${value}; ${node}.nodeValue = ${_}text;\n`
        $.update += `let ${_}updatedText = ${value};
                     if (${_}text !== ${_}updatedText) ${node}.nodeValue = ${_}updatedText;
                     ${_}text = ${_}updatedText;\n`
      }
    } else {
      vchild.node = node;
      generateVnode(vchild, $);
      node = vchild.node;
    }
    node = node + ".nextSibling"
  }
}

function generateNodeName($, name) {
  if (name.indexOf(".") === -1) return name;
  const _ = prefix();
  $.create += `let ${_}node = ${name};\n`;
  return `${_}node`;
}

function compileValue(input) {
  let parts = [], part = "", lvl = 0, isDynamic = false, push = ([open, close]) => {
    if (part) parts.push(open + (lvl === 0 ? part.replace(/\n/g, "\\n") : part) + close);
    part = "", isDynamic ||= lvl;
  };
  for (let c of input) {
    if (c === "{" && lvl === 0) push(["'", "'"]), lvl++;
    else if (c === "}" && lvl === 1) push(["(", ")"]), lvl--;
    else part +=c;
  }
  push(lvl === 0 ? ["'", "'"] : ["(", ")"]);
  return [parts.length === 1 ? parts[0] : parts.join(" + "),
          isDynamic ? null : parts[0].slice(1, -1),
          isDynamic];
}

function compile(template) {
  const tokens = lex(template), vnodes = [], parents = [];
  for (let i = 0, $ = tokens[0], x = tokens[1]; i < tokens.length; i += 2, $ = tokens[i], x = tokens[i+1]) {
    if ($ === "open") {
      const vchild = {tag: x, properties: {}, children: [], parent: parents[0]};
      (parents[0]?.children || vnodes).push(vchild);
      parents.unshift(vchild);
    } else if ($ === "close") {
      parents.shift();
    } else if ($ === "child") {
      (parents[0]?.children || vnodes).push(x);
    } else if ($ === "key") {
      parents[0].properties[x] = tokens[(i += 2) + 1];
    } else throw "unexpected: " + $;
  }
  if (parents.length) throw new Error(`unclosed ${parents[0].tag}: ${template}`);
  return vnodes;
}

function lex(template) {
  let $ = "child", tag = "", tmp = "", tokens = [], push = ($next) => {
    if (tmp.trim()) tokens.push($, tmp);
    if ($ === "open") tag = tmp;
    $ = $next, tmp = "";
  };
  for (let i = 0, c = template[0]; i < template.length; i++, c = template[i]) {
    if ($ === "child" && c === "<") {
      push(template[i+1] === "/" ? "close" : "open");
    } else if ($ !== "child" && (c === ">" || c === "/" && template[i+1] === ">")) {
      push("child");
      if (c === "/") i++;
      if (c === "/" || voidTags[tag]) tokens.push("close", "/");
    } else if ($ !== "child" && (c === " " || c === "\n")) {
      push("key");
      if (tokens[tokens.length - 2] === "key") tokens.push("value", "true");
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
