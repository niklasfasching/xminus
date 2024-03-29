import {html, css, route, render, query, db, useEffect, sub} from "../../src/jsxy.mjs";
import {Menu} from "./menu.mjs";
import {Show} from "./show.mjs";
import {Filters} from "./filters.mjs";

const history = await fetch("https://niklasfasching.github.io/freiluftkino/history.json").then(r => r.json());
const shows = await fetch("https://niklasfasching.github.io/freiluftkino/shows.json").then(r => r.json());
const showsByDate = groupShowsBy(shows, "date");
const showsByMovie = groupShowsBy(shows, "normalizedTitle");
const cinemas = [...new Set(Object.values(shows).map(x => x.cinemaShortName))].sort();

route({
  "/": wrap(ByDate, true),
  "/movies": wrap(ByMovie, true),
  "/show/{id}": wrap(Show),
}, document.body);

function wrap(tag, showFilters) {
  return function(props) {
    function onClose() {
      if (route.path === "/") render(props.$.main)
    }
    return html`<x-app>
      <${Nav} key=nav ...=${{shows, showsByMovie, onClose}}/>
      ${showFilters && html`<${Filters} key=filters cinemas=${cinemas} refs=${props.$}/>`}
      <main>
      <${tag} key=${tag.name} ...=${{history, shows, cinemas, showsByDate, showsByMovie}} ...=${props} $main/>
      </main>
    </x-app>`
  }
}

function Nav({$, onClose, shows, showsByMovie}) {
  const links = {
    "/": "By Date",
    "/movies/": "By Movie",
  };

  useEffect(() => sub(db, "favs", () => render($)));

  const favs = Object.keys(db.favs || {}).map(normalizedTitle => {
    const show = showsByMovie[normalizedTitle]?.filter(x => x.timestamp > Date.now())[0];
    if (!show) return;
    return html`
      <a :href="?/show/${show.id}" .show>
        <img loading="lazy" src=${show.img}/>
        <div .title>${show.title}</div>
        <div .cinema>${show.cinemaShortName}</div>
      </a>`;
  });

  return html`
    <nav>
      <a :href="?/"><img .logo src="assets/logo.svg"/></a>
      <${Menu} key=menu links=${links} onclose=${onClose} $menu>
      <div .favs-wrapper .hidden=${!favs.length}>
        <h1>Favorites</h1>
        <div .favs>
          ${favs}
        </div>
      </div>
      </>
    </nav>`;
}

function ByDate({$, showsByDate}) {
  useEffect(() => sub(query, "config", () => render($)));
  const days = Object.entries(showsByDate).map(([date, shows]) => {
    shows = filterByConfig(shows)
    if (!shows.length) return;
    shows = shows.map(x => html`
      <a :href="?/show/${x.id}" .show>
        <img loading="lazy" src=${x.img}/>
        <div .title>${x.title}</div>
        <div .cinema>${x.time} | ${x.cinemaShortName}</div>
      </a>
    `);
    return html`<div .day>
      <h1>${date.split(",")[1]}</h1>
      <div .shows>${shows}</div>
    </div>`
  });
  return html`<x-shows>${days.filter(Boolean)}</x-shows>`;
}

function ByMovie({$, showsByMovie}) {
  useEffect(() => sub(query, "config", () => render($)));
  const movies = Object.entries(showsByMovie).map(([normalizedTitle, shows]) => {
    shows = filterByConfig(shows)
    if (!shows.length) return;
    const show = shows[0];
    return html`
      <a :href="?/show/${show.id}" .show>
        <img loading="lazy" src=${show.img}/>
        <div .title>${show.title}</div>
        <div .cinema>${show.cinemaShortName}</div>
      </a>
    `;
  });
  return html`<x-movies>${movies}</x-movies>`;
}

function filterByConfig(shows) {
  const activeCinemas = query.config?.cinemas || {};
  if (Object.keys(activeCinemas).length) {
    shows = shows.filter(x => activeCinemas[x.cinemaShortName]);
  }
  if (query.config?.searchTitle) {
    shows = shows.filter(x => x.normalizedTitle.includes(query.config?.searchTitle.toUpperCase()))
  }
  if (query.config?.ov || query.config?.en) {
    shows = shows.filter(x => {
      return (query.config.ov && x.version.original) || (query.config.en && x.version.english);
    })
  }
  return shows
}

function groupShowsBy(shows, key) {
  return Object.values(shows)
               .filter(x => x.timestamp >= Date.now())
               .sort((a, b) => a.timestamp - b.timestamp)
               .reduce((m, x) => {
                 m[x[key]] = (m[x[key]] || []).concat(x).sort((x, y) => x.time > y.time);
                 return m;
               }, {});
}
