/**
 * Creates a updateable react store with a remote api.
 * @param {Any} state Intitial State of your store
 */
export default function createStore(state): any {
	const listeners = new Set<Function>();

	const API = Object.freeze({
		getState(factory = _ => _) {
			return factory(state);
		},

		setState(partial) {
			const partialState = typeof partial === 'function' ? partial(state) : partial;
			/* This causes issues when modifying the object directly such as deleting an entity, not sure if I should keep it */
			// if (Object.is(state, partialState)) return;

			state = Object.assign({}, state, partialState);

			for (const listener of listeners) {
				try {
					listener(state);
				} catch {
					console.error('Failed to fire listener in zustand store.');
				}
			}
		},

		addListener(listener) {
			if (listeners.has(listener)) return;
			listeners.add(listener);

			return () => listeners.delete(listener);
		},

		removeListener(listener) {
			return listeners.delete(listener);
		},

		get listeners() {
			return listeners;
		}
	});

	function useState(factory = _ => _) {
		const [, forceUpdate] = React.useReducer(e => e + 1, 0);

		React.useEffect(() => {
			const handler = () => {
				forceUpdate();
			};

			listeners.add(handler);

			return () => void listeners.delete(handler);
		}, []);

		return API.getState(factory);
	}

	Object.assign(useState, API, {
		*[Symbol.iterator]() {
			yield API;
			yield useState;
		}
	});

	return useState;
}