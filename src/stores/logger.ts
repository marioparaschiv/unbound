import createStore from '@structures/store';

const store = createStore({ logs: [] });

export function addLog({ message, level }) {
	store.setState(prev => ({
		logs: [
			// Store a maximum of 50 logs at once to avoid using up too much memory.
			...prev.logs.slice(-50),
			{
				time: Date.now(),
				message,
				level
			}
		]
	}));
}

export default store;