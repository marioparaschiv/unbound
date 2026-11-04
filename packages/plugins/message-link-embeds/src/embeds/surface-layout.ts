import { Surface } from '~/constants';

export type SurfaceLayoutMetrics = {
	contentHeight: number;
	viewportHeight: number;
	offsetX: number;
	offsetY: number;
	topInset: number;
	bottomInset: number;
	inverted: boolean;
};

export type BottomAnchor = {
	atBottom: boolean;
	inverted: boolean;
	x: number;
	y: number;
};

export type ScrollOffset = {
	x: number;
	y: number;
};

type StructFields = Record<string, unknown>;

// The bridge returns structs either as their fields or wrapped as `{ name, value }`.
function structFields(raw: unknown): StructFields {
	if (!raw || typeof raw !== 'object') return {};

	const struct = raw as { value?: unknown };

	return struct.value && typeof struct.value === 'object'
		? (struct.value as StructFields)
		: (raw as StructFields);
}

function bottomOffset(metrics: SurfaceLayoutMetrics): number {
	const maximumOffset = metrics.contentHeight - metrics.viewportHeight + metrics.bottomInset;

	return metrics.inverted ? -metrics.topInset : Math.max(-metrics.topInset, maximumOffset);
}

/**
 * @description Computes how wide an embed can be, from the message label's frame in its cell.
 * @param labelInCell The label's `CGRect` converted into the cell's coordinates.
 * @param cellBounds The cell's `bounds`.
 * @returns The width from the label's left edge to the cell's right padding, or the label's own width.
 */
export function availableMessageWidthFromNative(labelInCell: unknown, cellBounds: unknown): number {
	const label = structFields(labelInCell);
	const labelWidth = Number(structFields(label.size).width);
	const left = Number(structFields(label.origin).x);
	const cellWidth = Number(structFields(structFields(cellBounds).size).width);

	if (!Number.isFinite(labelWidth)) return 0;
	if (!Number.isFinite(cellWidth) || !Number.isFinite(left)) return labelWidth;

	const availableWidth = cellWidth - left - 12;

	if (!Number.isFinite(availableWidth) || availableWidth < Surface.minWidth) return labelWidth;

	return Math.max(labelWidth, Math.min(cellWidth, availableWidth));
}

/**
 * @description Reads a table view's scroll geometry from its native values.
 * @param values `contentSize`, `contentOffset`, `bounds`, `transform`, and `adjustedContentInset`, in that order.
 * @returns The table's layout metrics.
 */
export function layoutMetricsFromNative(values: readonly unknown[]): SurfaceLayoutMetrics {
	const contentSize = structFields(values[0]);
	const contentOffset = structFields(values[1]);
	const boundsSize = structFields(structFields(values[2]).size);
	const transform = structFields(values[3]);
	const contentInset = structFields(values[4]);

	return {
		bottomInset: Number(contentInset.bottom ?? 0),
		contentHeight: Number(contentSize.height),
		inverted: Number(transform.d) < 0,
		offsetX: Number(contentOffset.x),
		offsetY: Number(contentOffset.y),
		topInset: Number(contentInset.top ?? 0),
		viewportHeight: Number(boundsSize.height),
	};
}

/**
 * @description Records where the chat is scrolled and whether that is its bottom.
 * @param metrics The table's layout metrics.
 * @param tolerance How far from the bottom still counts as at the bottom, in points.
 * @returns The current scroll anchor.
 */
export function readBottomAnchor(
	metrics: SurfaceLayoutMetrics,
	tolerance: number = 36,
): BottomAnchor {
	const targetOffset = bottomOffset(metrics);
	const atBottom =
		Number.isFinite(targetOffset) &&
		Number.isFinite(metrics.offsetY) &&
		Math.abs(targetOffset - metrics.offsetY) <=
			Math.max(tolerance, metrics.topInset + metrics.bottomInset);

	return {
		atBottom,
		inverted: metrics.inverted,
		x: Number.isFinite(metrics.offsetX) ? metrics.offsetX : 0,
		y: Number.isFinite(metrics.offsetY) ? metrics.offsetY : 0,
	};
}

/**
 * @description Records the scroll anchor for an embed, pinning the latest message to the bottom while it is near it.
 * @param metrics The table's layout metrics.
 * @param followsLatestMessage Whether the embed belongs to the channel's latest message.
 * @param tolerance How far from the bottom still counts as at the bottom, in points.
 * @returns The scroll anchor to restore after the embed resizes.
 */
export function readSurfaceAnchor(
	metrics: SurfaceLayoutMetrics,
	followsLatestMessage: boolean,
	tolerance: number = 36,
): BottomAnchor {
	const anchor = readBottomAnchor(metrics, tolerance);

	if (
		followsLatestMessage &&
		Number.isFinite(metrics.offsetY) &&
		Math.abs(bottomOffset(metrics) - metrics.offsetY) <= Surface.maxHeight
	) {
		anchor.atBottom = true;
	}

	return anchor;
}

/**
 * @description Computes the scroll offset that puts the chat back at its bottom after a row resized.
 * @param anchor The anchor captured before the resize.
 * @param metrics The table's layout metrics after the resize.
 * @param userIsScrolling Whether the user is touching or flinging the table.
 * @returns The offset to scroll to, or `undefined` when no correction is needed.
 */
export function bottomOffsetCorrection(
	anchor: BottomAnchor,
	metrics: SurfaceLayoutMetrics,
	userIsScrolling: boolean,
): ScrollOffset | undefined {
	if (!anchor.atBottom || userIsScrolling) return;

	const targetOffset = bottomOffset(metrics);

	if (!Number.isFinite(targetOffset) || !Number.isFinite(metrics.offsetY)) return;
	if (Math.abs(targetOffset - metrics.offsetY) <= 1) return;

	return { x: anchor.x, y: targetOffset };
}

/**
 * @description Builds the height cache key for an embed of one message at one width.
 * @param channelId The linked message's channel.
 * @param messageId The linked message.
 * @param width The embed's width.
 * @returns The cache key.
 */
export function surfaceHeightCacheKey(channelId: string, messageId: string, width: number): string {
	return `${channelId}:${messageId}:${Math.round(width)}`;
}

/** Holds a bottom anchor until a resize lands, then yields the one correction it needs. */
export class BottomAnchorTracker {
	private anchor: BottomAnchor | undefined;

	get pending(): boolean {
		return this.anchor !== undefined;
	}

	capture(anchor: BottomAnchor | null): void {
		if (!anchor?.atBottom || this.anchor) return;

		this.anchor = anchor;
	}

	correction(metrics: SurfaceLayoutMetrics, userIsScrolling: boolean): ScrollOffset | undefined {
		if (!this.anchor) return;

		if (userIsScrolling) {
			this.clear();

			return;
		}

		const correction = bottomOffsetCorrection(this.anchor, metrics, false);

		if (correction) this.clear();

		return correction;
	}

	clear(): void {
		this.anchor = undefined;
	}
}

/** Remembers measured embed heights so a recycled cell starts at the right size. */
export class SurfaceHeightCache {
	private values = new Map<string, number>();

	constructor(private readonly limit: number = 128) {}

	get(key: string, fallback: number): number {
		const height = this.values.get(key);

		if (height === undefined) return fallback;

		this.values.delete(key);
		this.values.set(key, height);

		return height;
	}

	set(key: string, height: number): void {
		if (!Number.isFinite(height) || height <= 0) return;

		this.values.delete(key);
		this.values.set(key, height);

		if (this.values.size > this.limit) {
			this.values.delete(this.values.keys().next().value!);
		}
	}
}
