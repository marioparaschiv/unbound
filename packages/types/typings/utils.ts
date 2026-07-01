/** Any function: accepts any arguments and returns `T`. */
export type Fn<T = any> = (...args: any) => T;
/** Any function returning a promise (`T` defaults to `Promise<any>`). */
export type PromiseFn<T = Promise<any>> = (...args: any) => T;

/** An object of shape `T` widened with an arbitrary string/number/symbol index. */
export type AnyProps<T extends Record<PropertyKey, any> = Record<PropertyKey, any>> = T &
	Record<PropertyKey, any>;

/** A hexadecimal colour string prefixed with `#`. */
export type HexColor = `#${string}`;
/** An `rgba(...)` colour string. */
export type RgbaColor = `rgba(${string})`;
/** Any supported colour string: a {@link HexColor} or {@link RgbaColor}. */
export type ColorString = HexColor | RgbaColor;

/** The set of all falsy values. */
export type Falsy = false | 0 | '' | null | undefined;
/** The set of all truthy values. */
export type Truthy = true | number | string | object | symbol | bigint;
/** The result of a predicate: any {@link Truthy} or {@link Falsy} value. */
export type PredicateResult = Truthy | Falsy;

/** Widens a literal type to its primitive base (e.g. `'a'` to `string`, `1` to `number`). */
export type Widen<T> = T extends number
	? number
	: T extends string
		? string
		: T extends boolean
			? boolean
			: T;
