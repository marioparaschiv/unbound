declare type Fn<T = any> = (...args: any) => T;
declare type PromiseFn<T = Promise<any>> = (...args: any) => T;

declare type Constructor<T extends any> = (new () => T);

declare type AnyProps<T extends Record<string, any> = Record<string, any>> = T & Record<PropertyKey, any>;

declare type PropOf<M> = {
	[K in keyof M]: M[K] extends Fn ? Extract<K, string> : never
}[keyof M];

declare type Nullable<T extends Record<string, any>> = { [K in keyof T]?: T[K] };

declare type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;