export function emitGestures(el = document, threshold = document.body.clientWidth / 5) {
  let touches = new Map(), active = "";
  const event = (type, detail, bubbles = true, cancelable = true) =>
        new CustomEvent(type, {detail, bubbles, cancelable});

  el.addEventListener("touchstart", e => {
    if (e.touches.length !== 2 || active) return;
    for (let t of e.touches) touches.set(t.identifier, t);
    active = "gesture";
  });

  el.addEventListener("touchend", e => {
    for (let t of e.changedTouches) touches.delete(t.identifier);
    if (touches.size === 0) {
      if (active === "tap") {
        e.changedTouches[0].target.dispatchEvent(event("tap"));
      }
      active = "";
    }
  });

  el.addEventListener("touchmove", e => {
    if (touches.size !== 2) return;
    e.preventDefault();
    const [t1b, t2b] = e.touches;
    const [t1a, t2a] = [touches.get(t1b.identifier), touches.get(t2b.identifier)];

    // pinch: distance between the touch points at times a and b
    const dta = Math.hypot(t1a.screenX - t2a.screenX, t1a.screenY - t2a.screenY);
    const dtb = Math.hypot(t1b.screenX - t2b.screenX, t1b.screenY - t2b.screenY);

    // swipe: distance each touch point moved between times a and b
    const dt1 = Math.hypot(t1a.screenX - t1b.screenX, t1a.screenY - t1b.screenY);
    const dt2 = Math.hypot(t2a.screenX - t2b.screenX, t2a.screenY - t2b.screenY);

    if (Math.abs(dta - dtb) > threshold) {
      for (let t of e.touches) touches.set(t.identifier, t);
      const direction = dta - dtb > 0 ? "out" : "in";
      if (active === direction) return;
      t1b.target.dispatchEvent(event("pinch", direction));
      active = direction;
    } else if (dt1 > threshold && dt2 > threshold) {
      for (let t of e.touches) touches.set(t.identifier, t);
      const dx = t1a.screenX - t1b.screenX + t2a.screenX - t2b.screenX;
      const dy = t1a.screenY - t1b.screenY + t2a.screenY - t2b.screenY;
      const direction = dy*dy > dx*dx ? dy > 0 ? "up" : "down" : dx > 0 ? "left" : "right";
      if (active === direction) return;
      t1b.target.dispatchEvent(event("swipe", direction));
      active = direction;
      console.log("swipe")
    } else if (dt1 + dt2 < (t1b.radiusX + t1b.radiusY + t2b.radiusX + t2b.radiusY) * 10) {
      active = "tap"
    } else {
      active = "gesture";
    }
  }, {passive: false});
}
