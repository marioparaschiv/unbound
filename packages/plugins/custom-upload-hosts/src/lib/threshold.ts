const BYTES_PER_MB = 1024 * 1024;

export type UploadWhen = 'always' | 'auto' | 'size';

/**
 * @description The size above which a file goes to the upload host.
 * @param when The Send to the host setting.
 * @param minSizeMB The size setting, in MB.
 * @param channelLimit Discord's upload limit in the channel, in bytes, when known.
 * @returns The size in bytes, `0` for every file, or `undefined` when the limit is unknown.
 */
export function hostThreshold(
	when: string,
	minSizeMB: number,
	channelLimit: number | undefined,
): number | undefined {
	if (when === 'size') return Math.max(0, minSizeMB) * BYTES_PER_MB;
	if (when === 'auto') return channelLimit;

	return 0;
}

/**
 * @description Splits files into the ones for the upload host and the ones Discord takes.
 * @template F The file.
 * @param files The files with their sizes; a size of `undefined` stays with Discord.
 * @param threshold The size above which a file goes to the host.
 * @returns Both groups, in the original order.
 */
export function splitBySize<F>(
	files: { file: F; size: number | undefined }[],
	threshold: number,
): { hosted: F[]; attached: F[] } {
	const hosted: F[] = [];
	const attached: F[] = [];

	for (const { file, size } of files) {
		if (threshold === 0 || (size !== undefined && size > threshold)) hosted.push(file);
		else attached.push(file);
	}

	return { hosted, attached };
}
