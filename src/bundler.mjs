import {compile} from "./compiler.mjs";

export async function bundle(url, basePath = "/") {
  const asDataURL = basePath === null,
        xModules = await loadXModules(absoluteURL(url, location), basePath);
  const xComponents = xModules.map(x => x.xComponents).join("\n");
  const moduleCodeBlocks = xModules.flatMap(x => x.modules.map(m => [m.text, x.url]));
  if (asDataURL) {
    const imports = moduleCodeBlocks.slice(xModules[0].modules.length)
          .map(([code, path], i) => `//# sourceURL=${path}.${i}.js\n${code}`)
          .concat(`//# sourceURL=xmComponents.js\n${xComponents}`)
          .map(src => `import "${dataURL(src)}";`);
    return dataURL(imports.join("\n"));
  }
  const {document, xImports, xTemplates, modules} = xModules[0];
  for (let el of [...xImports, ...xTemplates, ...modules]) el.remove();
  const html = moduleCodeBlocks.map(([code]) => code).concat(xComponents).map(code => {
    return `<script type=module>\n${code}</script>`;
  }).join("\n");
  document.head.innerHTML = "\n" + html + document.head.innerHTML;
  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
}

export async function loadXModules(url, basePath, loaded = {}) {
  if (loaded[url]) return [];
  else loaded[url] = true;
  const document = url === location.href ? window.document : await loadDocument(url);
  const styles = all(document, `link[rel=stylesheet]`),
        modules = all(document, `[type*=module]:not([src])`),
        xTemplates = all(document, `[type*=x-template][id]`),
        xImports = all(document, `[type*=x-module][src]`);
  const xComponents = xTemplates.map(({id, text}) => compile(id, text)).join("\n"),
        xModules = await Promise.all(xImports.map(x => loadXModules(absoluteURL(x.src, url), basePath, loaded)));
  for (let s of styles) s.href = rebaseURL(s.getAttribute("href"), url, basePath);
  for (let m of modules) m.text = rebaseModuleImports(m.text, url, basePath);
  return [{url, document, modules, styles, xImports, xTemplates, xComponents}, ...xModules.flat()];
}

export function rebaseModuleImports(code, moduleURL, basePath) {
  const f = (_ , from, __, url) => `${from}'${rebaseURL(url, moduleURL, basePath)}'`;
  return code.replaceAll(/^\s*(import\s+(.*from\s+)?)["'](.+)["']/gm, f);
}

export function dataURL(string) {
  return `data:text/javascript,${encodeURIComponent(string)}`;
}

export function rebaseURL(url, baseURL, basePath) {
  if (basePath?.endsWith("/")) basePath = basePath.slice(0, -1);
  url = absoluteURL(url, baseURL, true);
  return url.startsWith("/") && basePath ? basePath + url : url;
}

function absoluteURL(url, baseURL, rootRelative) {
  if (/^(https?|data):/.test(url)) return url.toString();
  const {href, pathname} = new URL(url, baseURL);
  return rootRelative ? pathname : href;
}

function all(document, selector) {
  return [...document.querySelectorAll(selector)];
}

function loadDocument(url) {
  return fetch(url).then(async (r) => new DOMParser().parseFromString(await r.text(), "text/html"));
}