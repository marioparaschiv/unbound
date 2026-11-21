type ImageSource = { uri?: unknown };

/** An image's `source` prop: an asset id, one source or a list of sources. */
export type ImageSourceProp = number | ImageSource | ImageSource[] | null | undefined;

function fixSource(source: ImageSource): ImageSource {
	if (typeof source.uri === 'number') {
		return { ...source, uri: String(source.uri) };
	}

	return source;
}

/**
 * @description Returns the source with every numeric `uri` turned into a string, since Discord's native image view
 * crashes the app on a number.
 * @param source The image's `source` prop.
 * @returns The same source when nothing needed fixing, otherwise a fixed copy.
 */
export function fixImageSource(source: ImageSourceProp): ImageSourceProp {
	if (!source || typeof source !== 'object') {
		return source;
	}

	if (Array.isArray(source)) {
		const fixed = source.map(fixSource);

		return fixed.some((item, index) => item !== source[index]) ? fixed : source;
	}

	return fixSource(source);
}
