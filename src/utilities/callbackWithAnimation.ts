const easing = {
	type: 'easeInEaseOut',
	property: 'opacity',
	duration: 500
} as const;

export default function callbackWithAnimation<T extends Fn>(callback: T) {
	return ((...args) => {
		ReactNative.LayoutAnimation.configureNext({
			duration: 500,
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