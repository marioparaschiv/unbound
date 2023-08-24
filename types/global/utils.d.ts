declare type Fn = (...args: any) => any;

declare type Constructor = (new () => any);

declare type AnyProps<T extends { [prop: string]: any; } = Record<string, any>> = {
	[name: string]: any;
} & T;

declare type Arguments<T extends Fn> = T extends (...args: infer P) => any ? P : any[];

declare type PropOf<M> = {
	[K in keyof M]: M[K] extends Fn ? Extract<K, string> : never
}[keyof M];