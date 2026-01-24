/**
 * @description Merges styles and filters out nullish values. Similar to the [clsx](https://www.npmjs.com/package/clsx) library.
 * @param styles Nullable styling objects.
 * @return The merged style object.
 */
function mergeStyles(...styles: (Record<any, any> | boolean)[]) {
	return styles.reduce((previous, current) => {
		if (current) {
			Object.assign(previous, current);
		}

		return previous;
	}, {}) as Record<any, any>;
};

export default mergeStyles;