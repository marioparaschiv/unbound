const mdls = [...globalThis.modules.values()];
const find = (prop) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

globalThis.ReactNative = find('AppState');
globalThis.React = find('createElement');