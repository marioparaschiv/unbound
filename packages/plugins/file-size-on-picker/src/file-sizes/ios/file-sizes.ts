import type { FileSizeLookup } from '~/badges';

/**
 * @description Discord's picker already reports file sizes on iOS, so no lookup is needed.
 * @returns Always `undefined`.
 */
export function createFileSizeLookup(): FileSizeLookup | undefined {
	return undefined;
}

export default createFileSizeLookup;
