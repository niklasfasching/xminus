window.isCI = %v;
window.isHeadless = navigator.webdriver;
if (!isHeadless) window.close = (code = 0) => console.log("exit:", code);
window.openIframe = (src) => {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const onload = () => resolve(iframe), onerror = reject;
    document.body.appendChild(Object.assign(iframe, {onload, onerror, src}));
  });
};
