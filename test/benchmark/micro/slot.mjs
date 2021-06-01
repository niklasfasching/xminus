import {t, done} from "../src/test.mjs";

t.describe("slot population", () => {
  t.exitAfter();
  function populateBody() {
    document.body.innerHTML = `
      <div>some thing <p>else</p></div>
      <div>some thing <p>else</p></div>
      <div x-slot=a>a</div>
      <div>some thing <p>else</p></div>
      <div>other slot</div>
      <p x-slot=b>b</p>`;
  }

  t.bench("querySelector", (n) => {
    for (let i = 0; i < n; i++) {
      populateBody();
      const slots = {rest: document.createElement("div")};
      document.body.querySelectorAll("[x-slot]").forEach(el => {
        slots[el.getAttribute("x-slot")] = el;
        el.remove();
      });
      while (document.body.firstChild) slots.rest.append(document.body.firstChild);
      t.assert(slots.a);
      t.assert(slots.b);
      t.assert(slots.rest);
    }
  });

  t.bench("manual", (n) => {
    for (let i = 0; i < n; i++) {
      populateBody();
      const slots = {rest: document.createElement("div")};
      while (document.body.firstChild) {
        const slot = document.body.firstChild.getAttribute?.("x-slot");
        if (slot) slots[slot] = document.body.removeChild(document.body.firstChild);
        else slots.rest.append(document.body.firstChild);
      }
      t.assert(slots.a);
      t.assert(slots.b);
      t.assert(slots.rest);
    }
  });
});
