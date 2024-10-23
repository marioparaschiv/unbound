declare type Fn<T = any> = (...args: any) => T;

declare type PromiseFn<T = Promise<any>> = (...args: any) => T;

declare type Constructor<T extends any = any> = (new () => T);

declare type AnyProps<T extends Record<PropertyKey, any> = Record<PropertyKey, any>> = T & Record<PropertyKey, any>;

declare type PropOf<M> = {
	[K in keyof M]: M[K] extends Fn ? Extract<K, string> : never
}[keyof M];

declare type AnyString = string & NonNullable<unknown>;

declare type Values<T> = T[keyof T];

declare type Nullable<T extends Record<PropertyKey, any>> = { [K in keyof T]?: T[K] };

declare type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;