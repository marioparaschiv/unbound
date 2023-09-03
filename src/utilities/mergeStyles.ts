/**
 * @description Merges styles and allows predicates to return false
 * @param {...object} styles - Style objects
 * @return {object} Returns a merged style object.
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