declare global {
	var nativeLoggingHook: (message: string, level: string) => void;

	const __r: {
		importAll: Fn;
	} & ((id: number | string) => void);

	interface Window {
		modules: Map<number, any>;
	}
}

export { };