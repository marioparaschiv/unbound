const MEGABYTE = 1024 * 1024;

/**
 * @description Formats a byte count as megabytes, with one decimal under 10 MB.
 * @param bytes The size in bytes.
 * @returns The size, such as `47 MB` or `8.5 MB`.
 */
export function formatMegabytes(bytes: number): string {
	const megabytes = bytes / MEGABYTE;

	return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

/**
 * @description Decides whether opening an attachment should ask first.
 * @param bytes The attachment's size, if known.
 * @param thresholdMegabytes The size that asks, in megabytes.
 * @param cellular Whether the device is on mobile data.
 * @returns Whether to ask.
 */
export function shouldAsk(
	bytes: number | undefined,
	thresholdMegabytes: number,
	cellular: boolean,
): boolean {
	return cellular && typeof bytes === 'number' && bytes >= thresholdMegabytes * MEGABYTE;
}

export default { formatMegabytes, shouldAsk };
