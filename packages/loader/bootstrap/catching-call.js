(listener, value) => {
	try {
		const result = listener(value);

		return result === undefined ? undefined : { result };
	} catch (error) {
		return String(error && error.message ? error.message : error);
	}
};
