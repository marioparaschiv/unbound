type MessageStoreCandidate = {
	_dispatcher?: unknown;
	getName?: () => string;
};

export function isMessageStoreCandidate(candidate: unknown): boolean {
	if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function'))
		return false;
	try {
		const prototype = Object.getPrototypeOf(candidate);
		if (
			!prototype ||
			typeof Object.getOwnPropertyDescriptor(prototype, 'getMessage')?.value !== 'function'
		)
			return false;
		const store = candidate as MessageStoreCandidate;
		return Boolean(
			store._dispatcher &&
			typeof store.getName === 'function' &&
			store.getName() === 'MessageStore',
		);
	} catch {
		return false;
	}
}
