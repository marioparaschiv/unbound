export type Attachment = {
	filename?: string;
	size?: number;
	width?: number | null;
	height?: number | null;
	content_type?: string;
	original_content_type?: string;
	duration_secs?: number;
	description?: string;
	flags?: number;
	url?: string;
};

export type DetailKey =
	| 'name'
	| 'type'
	| 'originalType'
	| 'size'
	| 'dimensions'
	| 'duration'
	| 'altText'
	| 'spoiler';

export type Detail = { key: DetailKey; value: string };

const UNITS = ['B', 'KB', 'MB', 'GB'];
const SPOILER_FLAG = 1 << 3;

/**
 * @description Writes a byte count the way file managers do, in powers of 1,024.
 * @param bytes The size in bytes.
 * @returns The size, such as `43.1 KB`.
 */
export function formatSize(bytes: number): string {
	let value = bytes;
	let unit = 0;

	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}

	return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${UNITS[unit]}`;
}

/**
 * @description Writes a duration as minutes and seconds, with hours when needed.
 * @param seconds The duration in seconds.
 * @returns The duration, such as `1:05` or `1:02:03`.
 */
export function formatDuration(seconds: number): string {
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = String(total % 60).padStart(2, '0');

	return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/**
 * @description Lists what Discord reports about an attachment, leaving out what it doesn't report.
 * @param attachment The attachment.
 * @returns The details in display order.
 */
export function detailsOf(attachment: Attachment): Detail[] {
	const details: Detail[] = [];
	const add = (key: DetailKey, value: string | undefined) => {
		if (value) details.push({ key, value });
	};

	add('name', attachment.filename);
	add('type', attachment.content_type);

	if (
		attachment.original_content_type &&
		attachment.original_content_type !== attachment.content_type
	) {
		add('originalType', attachment.original_content_type);
	}

	add('size', attachment.size === undefined ? undefined : formatSize(attachment.size));
	add(
		'dimensions',
		attachment.width && attachment.height
			? `${attachment.width} × ${attachment.height}`
			: undefined,
	);
	add(
		'duration',
		attachment.duration_secs === undefined
			? undefined
			: formatDuration(attachment.duration_secs),
	);
	add('altText', attachment.description);

	if ((attachment.flags ?? 0) & SPOILER_FLAG || attachment.filename?.startsWith('SPOILER_')) {
		add('spoiler', '✓');
	}

	return details;
}

export default { formatSize, formatDuration, detailsOf };
