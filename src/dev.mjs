export function fluidScale([screenMin, ratioMin], [screenMax, ratioMax], n, rem) {
  const vwMin = screenMin / 100, vwMax = screenMax / 100;
  return [...Array(n)].map((_, x) => {
    // vwPix is what changes, so it's our x, making targetPx y.
    // we want to linearly interpolate between the targetPx values - i.e. targetPx = y+b*vwPx
    // b is how much targetPx changes relative to vwPx - i.e. the ratio of the diffs
    // y is the targetPx value we want at x=0. As we want remMin at screenMin/vwMin we have to
    // subtract b*vwPxMin while correcting for the px/rem ratio
    const i = Math.ceil(-n/2) + x;
    let remMin = ratioMin**i, remMax = ratioMax**i;
    const targetPxDiff = (remMax - remMin) * rem, vwPxDiff = vwMax - vwMin;
    const b = targetPxDiff / vwPxDiff, y = remMin - ((b * vwMin) / rem);
    if (i === 0) return "--r0: 1rem;";
    if (remMin > remMax) [remMin, remMax] = [remMax, remMin];
    return `--r${i}: clamp(${remMin.toFixed(2)}rem, ${y.toFixed(2)}rem + ${b.toFixed(2)}vw, ${remMax.toFixed(2)}rem);`
  }).join("\n");
}

export function imgUrl(width = 500, height = 500, txt = `${width}x${height}`) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect fill="lightgrey" width="${width}" height="${height}"/>
      <text fill="darkgrey" font-family="sans-serif" font-size="50" font-weight="bold"
            x="50%" y="50%" text-anchor="middle">${txt}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf8,${svg}`;
}

export function lorem(i = 0, j = 1) {
  return loremIpsum.split("\n\n").slice(i, j).join("\n\n");
}

// https://la.wikisource.org/wiki/Lorem_ipsum
const loremIpsum = `
Lorem ipsum dolor sit amet, consectetur adipisici elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat. Quis aute iure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.

Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.

Nam liber tempor cum soluta nobis eleifend option congue nihil imperdiet doming id quod mazim placerat facer possim assum. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.

Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis.

At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, At accusam aliquyam diam diam dolore dolores duo eirmod eos erat, et nonumy sed tempor et et invidunt justo labore Stet clita ea et gubergren, kasd magna no rebum. sanctus sea sed takimata ut vero voluptua. est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.

Consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`;
