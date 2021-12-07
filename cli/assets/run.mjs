window.isCI = %v;
window.isHeadless = navigator.webdriver;
if (!isHeadless) window.close = (code = 0) => console.log("exit:", code);
window.openIframe = (src) => {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const onerror = reject;
    const onload = () => resolve(iframe);
    document.body.appendChild(Object.assign(iframe, {onload, onerror, src}));
  });
};
