try {
  const find = (prop: string) => Object.values(window.modules).find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

  window.React = find('createElement');
  window.ReactNative = find('AppState');

  import('@api/components');


  try {
    const Core = import('@core');
    Core.then(c => c.initialize());
  } catch (e) {
    alert('Enmity failed to initialize: ' + e.message);
  }
} catch (e) {
  alert('Enmity failed to initialize: ' + e.message);
}