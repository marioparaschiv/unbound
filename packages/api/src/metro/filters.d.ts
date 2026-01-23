declare const CACHE_KEY: unique symbol;
declare const _default: {
	byProps: typeof byProps;
	byDisplayName: typeof byDisplayName;
	byPrototypes: typeof byPrototypes;
	byName: typeof byName;
	byStore: typeof byStore;
	byFilePath: typeof byFilePath;
};
export declare function byDisplayName(name: string): MetroFilter;
export declare function byFilePath(path: string[]): MetroFilter;
export declare function byName(name: string): MetroFilter;
export declare function byProps(...props: string[]): MetroFilter;
export declare function byPrototypes(...prototypes: string[]): MetroFilter;
export declare function byStore(name: string, short?: boolean): MetroFilter;
export type MetroFilter = ((mdl: any, id: number | string) => boolean | never) & {
	[CACHE_KEY]: string;
	isRaw?: boolean;
};

export { _default as default };


