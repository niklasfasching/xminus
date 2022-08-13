import {html, css} from "../../src/jsxy.mjs";

css`
  x-bar {
  margin-bottom: -.5em;
  height: 1em;
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
  width 0.01s linear
  }

  x-player button {
  width: 100%;
  }
`

export function Player({src, i, n}) {
  function onClick(e) {
    const audio = e.target.nextSibling;
    const bar = e.target.parentNode.querySelector("x-bar .fill");
    bar.style.transition = "none";
    bar.style.width = "0%";
    audio.currentTime = 0;
    clearInterval(audio.interval);
    setTimeout(() => {
      bar.style.transition = `width 0.01s linear`;
      audio.play();
      audio.interval = setInterval(() => {
        bar.style.width = `${(audio.currentTime/n**2)*100}%`;
        if (audio.currentTime >= (Number(audio.dataset.i)+1)**2) {
          audio.pause();
          e.target.blur();
        }
      }, 10);
    }, 10); // force reset width to 0 before animating
  }
  const bars = new Array(n).fill().map((_, j) => html`
    <span .current=${i === j-1} .marker
          style="left: ${((j)**2/n**2)*100}%"/>
  `);
  return html`
    <x-player>
      <x-bar><div .fill/>${bars}</x-bar>
      <button onclick=${onClick}>Play</button>
      <audio data-i=${i} src=${src}/>
    </x-player>`;
}
