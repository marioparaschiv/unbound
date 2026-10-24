import type { ReactElement } from 'react';

import { BADGE_INSET, BYTE_FORMAT, BYTE_UNITS } from '~/constants';

export type MediaItemElement = ReactElement<{
	item?: { node?: { image?: { fileSize?: number } } };
	size?: number;
}>;

export type SizeBadge = {
	key: string;
	label: string;
	left: number;
};

/**
 * @description Formats a byte count in binary (1024-based) units with up to two decimals.
 * @param bytes A non-negative byte count.
 * @returns A label such as `1.5 MB`, or `0 Bytes` for an empty file.
 */
export function formatBytes(bytes: number): string {
	if (!bytes) return '0 Bytes';

	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);

	return `${BYTE_FORMAT.format(bytes / 1024 ** index)} ${BYTE_UNITS[index]}`;
}

/**
 * @description Places a size badge in the top-left corner of each media item in a picker row.
 * @param items The row's media item elements in slot order, with an empty slot as `null`.
 * @param padding The row's horizontal padding.
 * @param separator The gap between items.
 * @returns One badge per item with a known file size and a positive layout size.
 */
export function sizeBadgesForRow(
	items: (MediaItemElement | null)[],
	padding: number,
	separator: number,
): SizeBadge[] {
	const badges: SizeBadge[] = [];

	for (const [slot, item] of items.entries()) {
		if (!item) {
			continue;
		}

		const bytes = item.props.item?.node?.image?.fileSize;
		const size = item.props.size;

		if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) {
			continue;
		}

		if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
			continue;
		}

		badges.push({
			key: `file-size-${item.key ?? slot}`,
			label: formatBytes(bytes),
			left: padding + slot * (size + separator) + BADGE_INSET,
		});
	}

	return badges;
}
