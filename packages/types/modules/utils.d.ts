// Global utility types - automatically available without imports
declare global {
	type Fn<T = any> = (...args: any) => T;

	type PromiseFn<T = Promise<any>> = (...args: any) => T;

	type Constructor<T extends any = any> = (new () => T);

	type AnyProps<T extends Record<PropertyKey, any> = Record<PropertyKey, any>> = T & Record<PropertyKey, any>;

	type PropOf<M> = {
		[K in keyof M]: M[K] extends Fn ? Extract<K, string> : never
	}[keyof M];

	type AnyString = string & NonNullable<unknown>;

	type Values<T> = T[keyof T];

	type Nullable<T extends Record<PropertyKey, any>> = { [K in keyof T]?: T[K] };

	type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
}

// Export as a module to make this file both ambient and importable
export { };