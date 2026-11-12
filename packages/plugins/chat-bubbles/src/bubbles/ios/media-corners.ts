import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';

import type { messageLayout, SnapshotNode } from '~/bubbles/message-layout';
import type { BubbleAppearance } from '~/bubbles/style';
import type { Box } from '~/bubbles/geometry';
import { MediaCorners } from '~/constants';

/** The smallest radius rerounded media keeps, so a bubble radius at or under the padding never squares it off. */
const MINIMUM_MEDIA_RADIUS = 4;

type Layout = NonNullable<ReturnType<typeof messageLayout>>;

type Original = { view: NativeObjectHandle; radius: number; curve: unknown };

export type MediaFit = {
	frame: Box;
	radius: number;
	/** Discord's rounded media views in the message. */
	views: NativeObjectHandle[];
	/** The radius to give those views, or `undefined` to leave them as Discord drew them. */
	mediaRadius?: number;
};

/**
 * @description Fits a bubble to the rounded media at its top or bottom edge, and rounds that media again when asked, remembering Discord's own corners to restore.
 * @param objc The Objective-C bridge.
 * @returns `fit`, which picks the bubble's frame and radius, `apply`, which rounds or restores the media, and `restore`, which restores all of it.
 */
export function createMediaCorners(objc: NativeObjCBridge) {
	const originals = new Map<string, Original>();

	async function layerOf(view: NativeObjectHandle) {
		return (await objc.invokeAsync(view, 'layer', [])) as NativeObjectHandle;
	}

	async function ownRadius(view: NativeObjectHandle): Promise<number> {
		const key = viewKey(objc, view);
		const known = key === undefined ? undefined : originals.get(key);

		if (known) return known.radius;

		return Number(await objc.invokeAsync(await layerOf(view), 'cornerRadius', []));
	}

	async function fit(
		nodes: SnapshotNode[],
		layout: Layout,
		frame: Box,
		{ mediaCorners, radius, horizontalPadding: inset }: BubbleAppearance,
	): Promise<MediaFit> {
		const media = layout.roundedMedia;
		const views = (media?.indices ?? [])
			.map((index) => nodes[index]?.view)
			.filter((view): view is NativeObjectHandle => Boolean(view));
		const unchanged = { frame, radius, views };

		if (!media || !views[0] || mediaCorners === MediaCorners.none) return unchanged;

		const touchesTop = media.top - frame.y <= inset + 1;
		const touchesBottom = frame.y + frame.height - media.bottom <= inset + 1;

		if (!touchesTop && !touchesBottom) return unchanged;

		if (mediaCorners === MediaCorners.reround) {
			return { ...unchanged, mediaRadius: Math.max(MINIMUM_MEDIA_RADIUS, radius - inset) };
		}

		const own = await ownRadius(views[0]);

		if (mediaCorners === MediaCorners.concentric) return { ...unchanged, radius: own + inset };

		const top = touchesTop ? media.top : frame.y;
		const bottom = touchesBottom ? media.bottom : frame.y + frame.height;

		return { ...unchanged, frame: { ...frame, y: top, height: bottom - top }, radius: own };
	}

	async function round(view: NativeObjectHandle, radius: number, curve: unknown) {
		const layer = await layerOf(view);

		await objc.batch([
			{ target: layer, selector: 'setCornerRadius:', args: [radius] },
			{ target: layer, selector: 'setCornerCurve:', args: [curve] },
		]);
	}

	async function remember(key: string, view: NativeObjectHandle) {
		if (originals.has(key)) return;

		const layer = await layerOf(view);
		const [radius, curve] = await objc.batch([
			{ target: layer, selector: 'cornerRadius', args: [] },
			{ target: layer, selector: 'cornerCurve', args: [] },
		]);

		originals.set(key, { view, radius: Number(radius), curve });
	}

	async function restoreView(key: string) {
		const original = originals.get(key);

		if (!original) return;

		originals.delete(key);
		await round(original.view, original.radius, original.curve);
	}

	async function apply(views: NativeObjectHandle[], radius: number | undefined) {
		for (const view of views) {
			const key = viewKey(objc, view);

			if (key === undefined) continue;

			if (radius === undefined) {
				await restoreView(key);
				continue;
			}

			await remember(key, view);
			await round(view, radius, 'continuous');
		}
	}

	return {
		fit,
		apply,
		async restore() {
			await Promise.all([...originals.keys()].map((key) => restoreView(key)));
		},
	};
}

export default { createMediaCorners };
