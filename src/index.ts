try {
  const find = (prop: string) => Object.values(modules).find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

  window.ReactNative = find('AppState');
  window.React = find('createElement');

  try {
    const Core = import('@core');
    Core.then(c => c.initialize());
  } catch (e) {
    alert('Enmity failed to initialize: ' + e.message);
  }
} catch (e) {
  alert('Enmity failed to initialize: ' + e.message);
}