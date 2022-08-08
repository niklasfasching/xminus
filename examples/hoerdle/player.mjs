import {html, css} from "../../src/jsxy.mjs";

css`
  x-bar {
  height: .5em;
  display: block;
  position: relative;
  overflow: hidden;
  }

  x-bar .marker {
  position: absolute;
  background: #aaa;
  height: 100%;
  width: .125rem;
  }

  x-bar .marker.current {
  background: black;
  }

  x-bar .fill {
  position: absolute;
  background: black;
  height: 100%;
  }

  x-player button {
  width: 100%;
  }
`

export function Player({src, i, n}) {
  function onClick(e) {
    const audio = e.target.nextSibling;
    const bar = e.target.parentNode.querySelector("x-bar .fill");
    const x = (i+1)**2;
    bar.style.transition = "none";
    bar.style.width = "0%";
    audio.currentTime = 0;
    clearTimeout(audio.timeout);
    setTimeout(() => {
      bar.style.transition = `width ${x}s linear`;
      bar.style.width = `${x/n**2*100}%`;
      audio.play();
      audio.timeout = setTimeout(() => {
        audio.pause();
        e.target.blur();
      }, x*1000);
    }, 10); // force reset width to 0 before animating
  }

  const bars = new Array(n).fill().map((_, j) => html`
    <span .current=${i === j-1} .marker
          style="left: ${((j)**2/n**2)*100}%"/>
  `);
  return html`
    <x-player>
      <x-bar><div .fill style="width: 0%"/>${bars}</x-bar>
      <button onclick=${onClick}>Play</button>
      <audio src=${src}/>
    </x-player>`;
}
