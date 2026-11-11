/**
 * @description The default bundle's hot-refresh runtime. Nothing this build contains runs with the
 * refresh transform applied, so no component ever registers and each call keeps its identity.
 */
import type * as runtime from '~/hot-refresh/runtime';

type Runtime = typeof runtime;

/**
 * @description Returns the component as written.
 * @template T The component or `memo` / `forwardRef` object.
 * @param value The component from this run of its module.
 * @param _id The family id the refresh transform would register it under.
 * @returns `value`.
 */
export const canonical: Runtime['canonical'] = (value, _id) => value;

/**
 * @description Runs a bundle with no scope to register components under.
 * @template T What the bundle returns.
 * @param _scope Prefixes family ids; unused without a refresh runtime.
 * @param evaluate Runs the bundle's top-level code.
 * @returns What `evaluate` returned.
 */
export const withRefreshScope: Runtime['withRefreshScope'] = (_scope, evaluate) => evaluate();

/**
 * @description Returns Discord's React, since no component is registered to swap for a stable forwarder.
 * @returns Discord's React.
 */
export const createScopedReact: Runtime['createScopedReact'] = () => React;

/**
 * @description Returns the component as written.
 * @template T The component type.
 * @param type A component, which stays as it is when nothing registered it.
 * @returns `type`.
 */
export const stableType: Runtime['stableType'] = (type) => type;

/**
 * @description Reports no refresh, since nothing registered a component.
 * @returns No fibers re-rendered or remounted.
 */
export const performRefresh: Runtime['performRefresh'] = () => ({
	count: 0,
	remounted: 0,
});

/**
 * @description Ignores a registration, which only a refresh-transformed bundle makes.
 * @param _type The registered component.
 * @param _id The family id it registered under.
 */
export const register: Runtime['register'] = (_type, _id) => {};

/**
 * @description Stands in for React Fast Refresh's signature tracking and returns each component unchanged.
 * @returns The identity signature function.
 */
export const createSignatureFunctionForTransform: Runtime['createSignatureFunctionForTransform'] =
	() =>
	<T>(type: T) =>
		type;
