import {html, css, render, useState, db} from "../../src/jsxy.mjs";
import {Player} from "./player.mjs";
import {Autocomplete} from "./autocomplete.mjs";

const tracks = await fetch("tracks.json").then(r => r.json())

render(document.body, html`<${App} tracks=${tracks}/>`);

export function App({tracks}, renderComponent) {
  const options = Object.keys(tracks);
  const i = Math.floor((Date.now() - new Date("2022-01-01").getTime()) / 1000 / 60 / 60 / 24);
  const track = options[i % options.length];

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
    return html`<${Resolution} ...=${state[today]} today=${today} reset=${reset}/>`
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
        src=${tracks[track]}/>
      <${Autocomplete}
        values=${options.filter(o => !guesses.includes(o))}
        cb=${onGuess}/>
      <h1>Guesses</h1>
      <ol>${list}</ol>
    </div>`;
}

function Resolution({guesses, n, track, today, reset}) {
  const url = "https://open.spotify.com/embed/track/d30a604135cdebfd3c58f31942f388f01cfb129c";
  return html`
    <div>
      <h1>You ${guesses.includes(track) ? "won" : "lost"} today</h1>
      <div>It was "${track}"</div>
      <div>${Array(5).fill("").map((_, i) => guesses[i] === track ? "o" : i >= guesses.length ? "-" : "x")}</div>
      <button onclick=${reset}>Reset</button>
    </div>`;
}
