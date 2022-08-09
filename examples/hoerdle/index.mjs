import {html, css, render, useState, db} from "../../src/jsxy.mjs";
import {Player} from "./player.mjs";
import {Autocomplete} from "./autocomplete.mjs";

const rawTracks = await fetch("tracks.json").then(r => r.json())
const tracks = rawTracks.reduce((m, x) => Object.assign(m, {[`${x.artist} - ${x.track}`]: x}), {});

render(html`<main><${App} tracks=${tracks}/></main>`, document.body);

css`
  x-app .guesses {
  display: grid;
  gap: 1em;
  grid-auto-rows: 1fr;
  }

  x-app .guesses div {
  border: .125em solid black;
  padding: 1em;
  }

  x-app .guesses .filled {
  background: #eee;
  }
`

export function App({tracks, $}) {
  const options = Object.keys(tracks);
  const now = new Date(Date.now() - (new Date().getTimezoneOffset() * 1000 * 60));
  const today = now.toISOString().slice(0, 10);
  const i = Math.floor((now.getTime() - new Date("2022-01-01").getTime()) / 1000 / 60 / 60 / 24);
  const track = options[i % options.length];
  const trackUrl = `https://www-growth.scdn.co/static/games/tracks/${tracks[track].transcoded_file_id}.mp3`;

  const state = db();
  if (!state[today]) db({...state, [today]: {guesses: [], n: 5, track}})
  const {guesses, n} = state[today];
  function onGuess(guess) {
    guesses.push(guess);
    db(true);
    render($);
  }

  if (guesses.includes(track) || guesses.length >= n) {
    const trackID = tracks[track].uri.split(":")[2];
    return html`<${Resolution} ...=${state[today]}
                               today=${today}
                               trackID=${trackID}/>`
  }

  const list = Array(n).fill("").map((_, i) => {
    return html`<div .filled=${guesses[i]}>${guesses[i] || "⠀"}</div>`
  });
  return html`
    <x-app>
      <section>
        <${Player}
              key=player
              i=${guesses.length}
              n=${n}
              src=${trackUrl}/>
        <${Autocomplete}
              values=${options.filter(o => !guesses.includes(o))}
              cb=${onGuess}/>
        <h2>Guesses</h2>
        <div .guesses>
          ${list}
        </div>
      </section>
    </x-app>
  `;
}

css`
  x-resolution .stats {
  font-size: 1.5em;
  letter-spacing: 0.2em;
  }
`;

function Resolution({guesses, n, track, trackID, today}) {
  const stats = Array(5).fill("")
                        .map((_, i) => guesses[i] === track ? "🟩" :
                                       guesses[i] === "<skip>" ? "🟨" :
                                       i >= guesses.length ? "⬜" : "🟥")
                        .join("");
  function copy() {
    navigator.clipboard.writeText(`${today}: ${stats}\n${location.href}`);
  }

  return html`
    <x-resolution>
      <h2>You ${guesses.includes(track) ? "won" : "lost"} today</h2>
      <iframe src="https://open.spotify.com/embed/track/${trackID}"
              width="100%" frameBorder="0" allow="autoplay; encrypted-media;"/>
      <div .stats>${stats}</div>
      <button onclick=${copy}>Copy results</button>
    </x-resolution>`;
}
