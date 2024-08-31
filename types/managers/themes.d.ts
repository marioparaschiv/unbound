import type { Addon } from '@typings/managers';

export type Theme = Addon & {
	instance: {
		semantic: Record<PropertyKey, {
			type: 'color' | 'raw';
			value: string;
			opacity?: number;
		}>;

		raw: Record<PropertyKey, string>;
		type: 'dark' | 'light';
		background?: {
			blur?: number;
			opacity?: number;
			url: string;
		};
	};
};