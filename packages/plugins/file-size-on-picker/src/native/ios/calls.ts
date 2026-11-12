import type { FileSizes } from '~/lib/types';

/**
 * @description Discord's picker already reports file sizes on iOS, so no lookup is needed.
 * @returns No lookup, and nothing to release.
 */
export function createFileSizes(): FileSizes {
	return { release: () => {} };
}

export default createFileSizes;
