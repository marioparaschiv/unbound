import type { Addon } from '@typings/managers';

export type Theme = Addon & {
	registered: boolean;
	instance: {
		semantic: Record<PropertyKey, {
			type: 'color' | 'raw';
			value: string;
			opacity?: number;
		}>;
		raw: Record<PropertyKey, string>;
		type: 'midnight' | 'darker' | 'light';
		background?: {
			blur?: number;
			opacity?: number;
			url: string;
		};
	};
};