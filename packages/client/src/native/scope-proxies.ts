import type { AddonAttribution } from '~/addons/crash-guard';

type AttributedMethod = {
	original: unknown;
	attributed: unknown;
};

/**
 * @description Reads each member from the loader's bridge, or from the fallback where the loader lacks it.
 * @template T The bridge's shape.
 * @param bridge The loader's bridge, which may miss members older loaders do not have.
 * @param fallback The stand-in for every member.
 * @returns A bridge that always has every member.
 */
export function withFallback<T extends object>(bridge: Partial<T> | undefined, fallback: T): T {
	return new Proxy(fallback, {
		get: (target, property) => {
			const key = property as keyof T;

			return bridge?.[key] ?? target[key];
		},
	});
}

/**
 * @description Wraps each method of a bridge so the loader attributes a crash inside it to the plugin calling it.
 * @template T The bridge's shape.
 * @param source The bridge.
 * @param attribute Marks the plugin as active while a call runs, or `undefined` to leave the bridge as it is.
 * @returns The bridge whose methods carry the attribution, each wrapped once.
 */
export function attributeBridge<T extends object>(source: T, attribute?: AddonAttribution): T {
	if (!attribute) {
		return source;
	}

	const methods = new Map<PropertyKey, AttributedMethod>();

	return new Proxy(source, {
		get: (target, property) => {
			const value: unknown = Reflect.get(target, property);

			if (typeof value !== 'function') {
				return value;
			}

			const cached = methods.get(property);

			if (cached?.original === value) {
				return cached.attributed;
			}

			const attributed = attribute(value.bind(target));

			methods.set(property, { original: value, attributed });

			return attributed;
		},
	});
}
