import {html, css, render, useState, db} from "../../src/jsxy.mjs";
import {Player} from "./player.mjs";
import {Autocomplete} from "./autocomplete.mjs";

const rawTracks = await fetch("tracks.json").then(r => r.json())
const tracks = rawTracks.reduce((m, x) => Object.assign(m, {[`${x.artist} - ${x.track}`]: x}), {});

render(document.body, html`<${App} tracks=${tracks}/>`);

export function App({tracks}, renderComponent) {
  const options = Object.keys(tracks);
  const i = Math.floor((Date.now() - new Date("2022-01-01").getTime()) / 1000 / 60 / 60 / 24);
  const track = options[i % options.length];
  const trackUrl = `https://www-growth.scdn.co/static/games/tracks/${tracks[track].transcoded_file_id}.mp3`;

  const today = new Date().toISOString().substring(0,10);
  const state = db();
  if (!state[today]) db({...state, [today]: {guesses: [], n: 5, track}})
  const {guesses, n} = state[today];
  function onGuess(guess) {
    guesses.push(guess);
    db(true);
    renderComponent();
  }

  if (guesses.includes(track) || guesses.length >= n) {
    const reset = () => {
      db({[today]: null});
      renderComponent();
    }
    const trackID = tracks[track].uri.split(":")[2];
    return html`<${Resolution} ...=${state[today]}
                               today=${today} reset=${reset}
                               trackID=${trackID}/>`
  }

  const list = Array(n).fill("").map((_, i) => {
    return html`<li>${guesses[i] || ""}</li>`
  });
  return html`
    <div>
      <${Player}
        key=player
        i=${guesses.length}
        n=${n}
        src=${trackUrl}/>
      <${Autocomplete}
        values=${options.filter(o => !guesses.includes(o))}
        cb=${onGuess}/>
      <h1>Guesses</h1>
      <ol>${list}</ol>
    </div>`;
}

function Resolution({guesses, n, track, trackID, today, reset}) {

  const stats = Array(5).fill("")
                        .map((_, i) => guesses[i] === track ? "🟩" :
                                       guesses[i] === "<skip>" ? "🟨" :
                                       i >= guesses.length ? "⬜" : "🟥")
                        .join("");
  function copy() {
    navigator.clipboard.writeText(`${today}: ${stats}\n${location.href}`);
  }

  return html`
    <div>
      <h1>You ${guesses.includes(track) ? "won" : "lost"} today</h1>
      <iframe src="https://open.spotify.com/embed/track/${trackID}"
              frameBorder="0" allow="autoplay; encrypted-media;"/>
      <div>Results: ${stats} <button onclick=${copy}>Copy</button></div>
      <button onclick=${reset}>Reset</button>
    </div>`;
}
