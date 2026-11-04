import type { ComponentType, FunctionComponent } from 'react';

type Primitive = string | number | boolean | bigint | null | undefined;

/** A callback the generator typed: kept as is, since its parameters and arity are what a caller relies on. */
// UNKNOWN: any callback matches, whatever it returns.
type Callback = (...args: never[]) => unknown;

/** A value the generator could not type with confidence, so a loose prop accepts anything for it. */
// oxlint-disable-next-line typescript/no-explicit-any -- a weak generated type must never reject a correct value
type UncertainValue = any;

/**
 * The value type a loose prop accepts: a primitive, literal union or callback stays checked; anything else the
 * generator inferred (`any`, objects, React nodes, wide unions) is {@link UncertainValue}.
 */
export type LoosePropValue<T> = 0 extends 1 & T
	? UncertainValue
	: [NonNullable<T>] extends [Primitive]
		? T
		: [NonNullable<T>] extends [Callback]
			? T
			: UncertainValue;

/**
 * Generated component props made safe to pass: every known prop is optional and checked only where its type is
 * concrete, and any other prop is allowed, since the generator can miss props or mark a defaulted one required.
 */
// oxlint-disable-next-line oxc-config/no-unsafe-dictionary-type -- props the generator never saw take any value
export type LooseProps<P> = { [K in keyof P]?: LoosePropValue<P[K]> } & Record<string, unknown>;

/** A generated component that also accepts {@link LooseProps}, keeping its statics such as `TableRow.Icon`. */
// JSX falls back to the loose signature when the generated props reject a value; `ComponentProps` reads it.
// Adding a signature checks far faster than rebuilding the component without its own.
export type LooseComponent<C> =
	C extends ComponentType<infer P> ? C & FunctionComponent<LooseProps<P>> : C;

/** Each export of a generated module with {@link LooseComponent} applied. */
export type LooseModule<M> = { [K in keyof M]: LooseComponent<M[K]> };
