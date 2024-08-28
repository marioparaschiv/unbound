import { LayoutAnimation, type LayoutAnimationConfig } from 'react-native';

export const DEFAULT_ANIMATION = {
	type: 'easeInEaseOut',
	property: 'opacity'
} as const;

/**
 * @description Animates the provided callback using a layout animation.
 * @template T Your function's type. Used for inferring function parameters and the return type.
 * @param callback The callback that will trigger a UI update to animate.
 * @param options The layout animation options. Se e [LayoutAnimationConfig](https://reactnative.dev/docs/layoutanimation#configurenext) for more information. (Optional)
 * @returns Returns a callable function that configures a layout animation before running the provided callback, resulting in an animated UI update.
 */
export default function animate<T extends Fn>(callback: T, options?: LayoutAnimationConfig): T {
	options ??= { duration: 500 };
	options.duration ??= 500;

	// If no animation is provided, use our default ones.
	if (!options.create && !options.delete && !options.update) {
		options.create = DEFAULT_ANIMATION;
		options.update = DEFAULT_ANIMATION;
		options.delete = DEFAULT_ANIMATION;
	}

	return ((...args: Parameters<T>) => {
		LayoutAnimation.configureNext(options);

		return callback(...args);
	}) as T;
}