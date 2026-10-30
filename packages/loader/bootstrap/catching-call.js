(listener, value) => {
	try {
		listener(value);
		return undefined;
	} catch (error) {
		return String(error && error.message ? error.message : error);
	}
};
