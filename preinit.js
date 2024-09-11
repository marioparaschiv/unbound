const mdls = Object.values(window.modules);
const find = (prop) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

window.ReactNative = find('AppState');
window.React = find('createElement');