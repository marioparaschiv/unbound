try {
  const Core = import('@core');
  Core.then(c => c.initialize());
} catch (e) {
  alert('Enmity failed to initialize: ' + e.message);
}