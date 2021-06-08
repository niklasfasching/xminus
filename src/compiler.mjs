import {parse, parseValue, parseValueParts} from "./parser.mjs";

const macros = [
  [/^\.inject:/, injectMacro],
  [/^\.if$/, ifMacro],
  [/^\.for$/, forMacro],
  [/^\.on:/, onMacro],
  [/^\.bind:/, bindMacro],
  [/^\.\./, classMacro],
  [/^--/, cssVarMacro],
  [/^#/, idMacro],
  [/^\|.*\|$/, slotMacro]
];

const splatRegexp = /^\s*{\s*\.\.\.\s*(.+)\s*}\s*$/;

function bindMacro(vnode, $, key, value) {
  const [_, property] = key.split(":");
  generateVnode(vnode, $);
  const event = ["input", "textarea"].includes(vnode.tag) && vnode.properties.type !== "checkbox" ? "keyup" : "change";
  const node = generateLocalNodeRef($, vnode, "bind");
  let getValue = `${node}["${property}"]`, setValue = `${node}["${property}"] = ${value}`;
  if (property === "options") {
    getValue = `Object.fromEntries([...${node}.selectedOptions].map(o => [o.value, true]))`;
    setValue = `for (let o of ${node}.options) o.selected = (${value})?.[o.value] || false`;
  }
  $.create += `if (${value} !== undefined) ${setValue};\n
               ${node}.addEventListener("${event}", () => ${value} = ${getValue});\n`;
  $.update += `if (document.activeElement !== ${node}) ${setValue};\n`;
}

function classMacro(vnode, $, key, value) {
  if (value === "true" || value === "") vnode.properties.class = (vnode.properties.class || "") + " " + key.slice(2).trim();
  else {
    $.create += `${vnode.ref}.classList.toggle(${parseValue(key.slice(2))[0]}, ${value});\n`;
    $.update += `${vnode.ref}.classList.toggle(${parseValue(key.slice(2))[0]}, ${value});\n`;
  }
  generateVnode(vnode, $);
}

function slotMacro(vnode, $, key, value) {
  vnode.properties["x-slot"] = key.slice(1, -1);
  generateVnode(vnode, $);
}

function cssVarMacro(vnode, $, key, value) {
  $.create += `${vnode.ref}.style.setProperty(${parseValue(key.slice(2))[0]}, "${value}");\n`;
  $.update += `${vnode.ref}.style.setProperty(${parseValue(key.slice(2))[0]}, "${value}");\n`;
  generateVnode(vnode, $);
}

function idMacro(vnode, $, key, value) {
  vnode.properties.id = key.slice(1).trim();
  generateVnode(vnode, $);
}

function injectMacro(vnode, $, key, value) {
  const [_, selector] = key.split(":");
  $.create += `$["${value}"] = $.xParent.closest("${selector}");\n`;
  generateVnode(vnode, $);
}

function onMacro(vnode, $, key, value) {
  generateVnode(vnode, $);
  const [_on_, event, ...modifiers] = key.split(":");
  if (event === "update" || event === "create") {
    const node = generateLocalNodeRef($, vnode, "on");
    $.create += `function ${node}_fn() { ${value} }\n`;
    $[event] += `setTimeout(() => ${node}_fn.call(${node}));\n`;
  } else {
    let after = "$.app.update();";
    if (modifiers.includes("no")) after = "";
    $.create += `${vnode.ref}.addEventListener("${event}", function($event) {
                   ${value};
                   ${after}
                 });\n`;
  }
}

function ifMacro(vnode, $, key, value) {
  const _ = prefix("if");
  generateClosure(vnode, $, _, "xm.symbols.updateIfNode",);
  $.create += `let ${_}connected = xm.nodeIf((${value}), ${_}anchor, ${_}anchor, $, ${_}create);
               ${vnode.ref} = ${_}connected;\n`;
  $.update += `${_}connected = xm.nodeIf((${value}), ${_}connected, ${_}anchor, $, ${_}create);\n`;
}

function forMacro(vnode, $, key, value) {
  let _ = prefix("for"),
      [name, inOrOf, values] = value.split(/ (of|in) /);
  if (inOrOf === "in") values = `Object.entries(${values} || {})`;
  generateClosure(vnode, $, _,
                  "xm.symbols.updateChildNode",
                  `let ${name} = _args[0];`,
                  `${name} = _args[0];`);
  $.create += `const ${_}values = [], ${_}nodes = [];
               xm.updateChildNodes(${_}anchor.parentNode, ${_}anchor, ${_}nodes, ${_}values, ${values} || [], $, ${_}create);\n`;
  $.update += `xm.updateChildNodes(${_}anchor.parentNode, ${_}anchor, ${_}nodes, ${_}values, ${values} || [], $, ${_}create);\n`;
}

export function compile(name, template) {
  const $ = {html: "", create: "", update: ""},
        vnode = Object.assign(parse(template)[0], {ref: "this"});
  const assignedProps = "[" + (vnode.properties["x-props"] || "").replaceAll(/(\w+)/g, `"$1",`) + "]";
  delete vnode.properties.id;
  delete vnode.properties.type;
  delete vnode.properties["x-props"];
  generateVnode(vnode, $);
  return `xm.register("${name}", \`${$.html.replaceAll("`", "\\`")}\`, function() {
    const $ = this;
    ${$.create}
    return () => {
      ${$.update}
    };
  }, ${assignedProps});\n`;
}

function generateClosure(vnode, $, _, updateKey, beforeCreate = "", beforeUpdate = "") {
  const $$ = {create: "", update: "", html: ""}, node = generateNodeRef($, vnode, "closure");
  generateVnode(vnode, $$);
  let inSVG = false;
  while (vnode = vnode.parent) inSVG |= vnode.tag === "svg";
  $.html += "<!---->";
  $.create += `let ${_}anchor = ${node}, ${_}node = xm.fragment(\`${$$.html.replaceAll("`", "\\`")}\`, ${inSVG}).firstChild;
               function ${_}create($, ..._args) {
                 let ${node} = ${_}node.cloneNode(true);
                 ${beforeCreate}
                 ${$$.create}
                 ${node}[${updateKey}] = (..._args) => {
                   ${beforeUpdate}
                   ${$$.update}
                   return ${node};
                 };
                 return ${node};
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
  generateNodeRef($, vnode, "vnode");
  const [tag, rawTag, isDynamicTag] = parseValue(vnode.tag);
  if (vnode.ref === "this") {
    generateProperties(vnode, $);
    generateChildren(vnode, $);
  } else if (!isDynamicTag && !isComponentTag(rawTag)) {
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
    const [splats, kvs] = Object.entries(vnode.properties).reduce(([splats, props], [k, v]) => {
      if (!splatRegexp.test(k)) return [splats, props.concat(`[${parseValue(k)[0]}]: ${parseValue(v)[0]}`)];
      return [splats.concat(k.match(splatRegexp)[1]), props];
    }, [[], []]);
    const props = splats.length ? `Object.assign({}, ${splats.join(", ")}, {${kvs.join(", ")}})` : `{${kvs.join(", ")}}`;
    $.create += `${vnode.ref}.init($.app, $, ${props});\n`;
    $.update += `${vnode.ref}.update(${props});\n`;
  } else {
    throw new Error("dynamic tags are currently not supported");
  }
}

function generateProperties(vnode, $) {
  const dynamicProperties = [];
  for (const k in vnode.properties) {
    const [key, rawKey, isDynamicKey] = parseValue(k),
          [value, rawValue, isDynamicValue] = parseValue(vnode.properties[k]);
    if (splatRegexp.test(k)) throw new Error(`splat properties are only allowed on component tags, not <${vnode.tag}>`);
    else if (!isDynamicKey && !isDynamicValue && vnode.ref === "this") $.create += `${vnode.ref}[${key}] = ${value};\n`;
    else if (!isDynamicKey && !isDynamicValue) $.html += ` ${rawKey}=${value}`;
    else dynamicProperties.push({key, value, isDynamicKey, isDynamicValue});
  }
  if (!dynamicProperties.length) return;
  const node = generateLocalNodeRef($, vnode, "properties");
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
  let node = vnode.ref + ".firstChild", dynamicChildren = [];
  for (const vchild of vnode.children) {
    node = generateNodeRef($, {ref: node}, "children");
    if (vchild.tag) {
      vchild.ref = node;
      generateVnode(vchild, $);
      node = vchild.ref;
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
          node = generateLocalNodeRef($, vnode, "children");

    $.create += `const ${_}nodes = [${nodes}], ${_}values = [];
                 xm.updateChildNodes(${node}, null, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
    $.update += `xm.updateChildNodes(${node}, null, ${_}nodes, ${_}values, [${values}], $, xm.createChildNode);\n`;
  }
}

function isComponentTag(tag) {
  return tag && tag.startsWith("x-");
}

function generateNodeRef($, vnode, key = "") {
  if (vnode.ref.indexOf(".") === -1) return vnode.ref;
  return vnode.ref = generateLocalNodeRef($, vnode, key);
}

function generateLocalNodeRef($, vnode, key = "") {
  const _ = prefix(key);
  $.create += `let ${_}node = ${vnode.ref};\n`;
  return `${_}node`;
}

let prefixId = 0;
export const resetPrefixId = () => prefixId = 0;
const prefix = (key) => `_${key}_${prefixId++}_`;
