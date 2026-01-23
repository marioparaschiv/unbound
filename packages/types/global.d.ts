import type { Fn } from './typings/utils';

declare global {
	var nativeLoggingHook: (message: string, level: any) => void;

	const __r: {
		importAll: Fn;
	} & ((id: number | string) => void);

	interface Window {
		modules: Map<number, any>;
	}
}

export {};
