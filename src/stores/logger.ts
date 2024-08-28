import createStore from '@structures/store';

const [store, useStore] = createStore({ logs: [] });

export function addLog({ message, level }) {
	store.setState(prev => ({
		logs: [
			// Store a maximum of 50 logs at once to avoid memory leaks
			...prev.logs.slice(prev.logs.length - 49),
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