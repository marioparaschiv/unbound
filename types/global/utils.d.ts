declare type Fn<T = any> = (...args: any) => T;

declare type Constructor = (new () => any);

declare type AnyProps<T extends Record<string, any> = Record<string, any>> = T & Record<PropertyKey, any>;

declare type Arguments<T extends Fn> = T extends (...args: infer P) => any ? P : any[];

declare type PropOf<M> = {
	[K in keyof M]: M[K] extends Fn ? Extract<K, string> : never
}[keyof M];

declare type Nullable<T extends Record<string, any>> = { [K in keyof T]?: T[K] };