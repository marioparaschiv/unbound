import type { PatchType } from '@api/patcher';


export type BeforeCallback<F extends Fn> = (context?: any, args?: Parameters<F>, original?: F, unpatch?: () => void) => Parameters<F> | void;
export type InsteadCallback<F extends Fn> = (context?: any, args?: Parameters<F>, original?: F, unpatch?: () => void) => ReturnType<F> | void;
export type AfterCallback<F extends Fn> = (context?: any, args?: Parameters<F>, result?: ReturnType<F>, unpatch?: () => void) => ReturnType<F> | void;

export interface PatchOverwrite {
	mdl: Record<string, any> | Function;
	func: string;
	original: Function;
	unpatch: () => void;
	patches: {
		before: Patch[];
		after: Patch[];
		instead: Patch[];
	};
}

export interface Patch {
	caller: string;
	once: boolean;
	type: PatchType;
	id: number;
	callback: any;
	unpatch: () => void;
}