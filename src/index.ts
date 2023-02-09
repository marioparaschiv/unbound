const Core = import('@core');

try {
  Core.then(c => c.initialize());
} catch (e) {
  alert('Enmity failed to initialize: ' + e.message);
}