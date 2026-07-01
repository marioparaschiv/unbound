export interface UnboundGlobal {
	metro: typeof import('./metro/index.d.ts');
}

declare global {
	interface Window {
		unbound: UnboundGlobal;
	}

	const unbound: Window['unbound'];
}
