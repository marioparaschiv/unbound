import createStore from '@structures/store';

const [store, useStore] = createStore({ logs: [] });

export function addLog({ message, level }) {
  store.setState(prev => ({
    logs: [
      ...prev.logs,
      {
        time: Date.now(),
        message,
        level
      }
    ]
  }));
}

export { store as logger, useStore as useLogger };
export default { store, useStore };