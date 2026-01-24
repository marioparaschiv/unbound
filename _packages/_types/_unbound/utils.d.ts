export type FindInTreePredicate = (element: any) => boolean;
export interface FindInTreeOptions {
	ignore?: (string | symbol)[];
	walkable?: (string | symbol)[];
	maxProperties?: number;
}

export type HexColor = `#${string}`;
export type RgbaColor = `rgba(${string})`;
export type ColorString = HexColor | RgbaColor;

export type Fn<T = any> = (...args: any) => T;
export type PromiseFn<T = Promise<any>> = (...args: any) => T;

export type Constructor<T extends any = any> = (new () => T);

export type AnyProps<T extends Record<PropertyKey, any> = Record<PropertyKey, any>> = T & Record<PropertyKey, any>;
export type PropOf<M> = {
	[K in keyof M]: M[K] extends Fn ? Extract<K, string> : never
}[keyof M];

export type AnyString = string & NonNullable<unknown>;

export type Values<T> = T[keyof T];

export type Nullable<T extends Record<PropertyKey, any>> = { [K in keyof T]?: T[K] };

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;