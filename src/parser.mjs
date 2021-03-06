// https://html.spec.whatwg.org/multipage/syntax.html#void-elements
const voidTags = {area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1};
const badAttributeRegexp = /^({=?})$|[^=]=""|^{[^}]*$|^[^{]*}$/;

export function parseValue(input) {
  const [parts, isDynamic] = parseValueParts(input);
  return [parts.length === 1 ? parts[0][0] : parts.map(p => p[0]).join(" + "),
          isDynamic ? null : parts[0][1],
          isDynamic];
}

export function parseValueParts(input) {
  let parts = [], push = (lvl, part) => {
    if (part) parts.push([lvl === 1 ? `(${part})` : `"${part}"`, part, lvl === 1]);
  };
  lexValue(input, push);
  return [parts, parts.some(p => p[2])];
}

export function lexValue(input, push, count = Infinity) {
  let part = "", lvl = 0;
  for (let c of input) {
    if (c === "{") {
      if (lvl === 0) push(lvl, part), part = "", count--;
      else part += c;
      lvl++;
    } else if (c === "}") {
      if (lvl === 1) push(lvl, part), part = "", count--;
      else part += c;
      lvl--;
    } else {
      part +=c;
    }
    if (!count) return;
  }
  push(lvl, part);
}

export function parse(template) {
  const tokens = lex(template), vnodes = [], parents = [];
  for (let i = 0, [$, x] = tokens[0]; i < tokens.length; i++, [$, x] = tokens[i] || []) {
    if ($ === "open") {
      const vchild = {tag: x, properties: {}, children: [], parent: parents[0], void: !!voidTags[x]};
      (parents[0]?.children || vnodes).push(vchild);
      parents.unshift(vchild);
    } else if ($ === "close") {
      const vnode = parents.shift();
      if (vnode && x !== "/" && x !== "/" + vnode.tag) throw new Error(`unexpected close ${x} for <${vnode.tag}>`);
    } else if ($ === "child") {
      (parents[0]?.children || vnodes).push(x);
    } else if ($ === "key") {
      let k = x, v = tokens[i+1][0] === "value" ? tokens[++i][1] : "true";
      if (badAttributeRegexp.test(k)) throw new Error(`unexpected attribute key '${k}' for <${parents[0].tag}>`);
      if (badAttributeRegexp.test(v)) throw new Error(`unexpected attribute value '${v}' for <${parents[0].tag}>`);
      parents[0].properties[k] = v;
    } else throw "unexpected: " + $;
  }
  if (parents.length) throw new Error(`unclosed ${parents[0].tag}: ${template}`);
  return vnodes;
}

export function lex(template) {
  let $ = "child", tag = "", tmp = "", tokens = [], push = ($next) => {
    if (tmp) tokens.push([$, tmp.trim() ? tmp : "\n"]);
    if ($ === "open") tag = tmp;
    else if ($ === "close") tag = "";
    $ = $next, tmp = "";
  };
  for (let i = 0, c = template[0]; i < template.length; i++, c = template[i]) {
    if (c === "{") {
      lexValue(template.slice(i), (lvl, part) => {
        if (lvl) tmp += `{${part}}`, i += part.length + 1;
      }, 2);
    } else if ($ === "child" && c === "<") {
      if (template.slice(i+1, i+4) === "!--") i = skipComment(template, i);
      else push(template[i+1] === "/" ? "close" : "open");
    } else if ($ !== "child" && (c === ">" || c === "/" && template[i+1] === ">")) {
      push("child");
      if (c === "/") i++;
      if (c === "/" || voidTags[tag]) tokens.push(["close", "/"]);
    } else if ($ !== "child" && (c === " " || c === "\n")) {
      push("key");
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

function skipComment(template, i) {
  const j = template.indexOf("-->", i);
  if (j === -1) throw new Error(`unclosed comment: ${template.slice(i, i+20)}[...]`);
  return j + 2;
}
