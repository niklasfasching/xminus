// adapted from https://github.com/krausest/js-framework-benchmark/blob/master/frameworks/keyed/mithril/src/store.es6.js

export default class Store {
  selected = undefined
  rows = []
  id = 1
  lastUpdate = null
  measurements = {}
  callback = (name, ms) => console.log(name, ms)

  start(name) {
    this.lastUpdate = [name, performance.now()];
  }

  constructor() {
    const observer = new MutationObserver((mutationsList, observer) => {
      if (this.lastUpdate) this.callback(this.lastUpdate[0], performance.now() - this.lastUpdate[1])
      this.lastUpdate = null;
    });
    observer.observe(document, {attributes: true, childList: true, subtree: true, characterData: true});
  }

  createRows(count = 1000) {
    this.start("createRows")
    const random = (max) => Math.round(Math.random() * max);
    var adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
    var colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
    var nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];
    const rows = [];
    for (var i = 0; i < count; i++)
      rows.push({id: this.id++, label: adjectives[random(adjectives.length)] + " " + colours[random(colours.length)] + " " + nouns[random(nouns.length)] });
    return rows;
  }

  run() {
    this.start("run")
    this.rows = this.createRows();
    this.selected = undefined;
  }

  runLots() {
    this.start("runLots")
    this.rows = this.createRows(10000);
    this.selected = undefined;
  }

  clear() {
    this.start("clear")
    this.rows = [];
    this.selected = undefined;
  }

  add() {
    this.start("add")
    this.rows.push(...this.createRows(1000));
  }

  remove(id) {
    this.start("remove")
    this.rows.splice(this.rows.findIndex(x => x.id === id), 1);
  }

  select(id) {
    this.start("select")
    this.selected = id;
  }

  update(mod = 10) {
    this.start("update")
    for (let i = 0; i < this.rows.length; i += 10) this.rows[i].label += ' !!!';
  }

  swapRows() {
    this.start("swapRows")
    if (this.rows.length > 998) {
      const tmp = this.rows[1];
      this.rows[1] = this.rows[998];
      this.rows[998] = tmp;
    }
  }
}
