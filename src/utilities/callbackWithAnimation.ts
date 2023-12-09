export default function callbackWithAnimation<T extends Fn>(callback: T, duration = 500) {
	const easing = {
		type: 'easeInEaseOut',
		property: 'opacity',
		duration
	} as const;

	return ((...args) => {
		ReactNative.LayoutAnimation.configureNext({
			duration,
			...['create', 'update', 'delete'].reduce((pre, cur) => {
				return {
					...pre,
					[cur]: easing
				};
			}, {})
		});

		callback(...args);
	}) as T;
}