import { metro, patcher } from '@unbound-app/api';
import type { ReactElement } from 'react';

const MEDIA_KEYBOARD_ITEM_PATH = 'modules/media_keyboard/native/components/MediaKeyboardItem.tsx';
const BADGE_INSET = 3;

type MediaNode = { image?: { fileSize?: unknown } };
type MediaItem = { node?: MediaNode };
type MediaChild = ReactElement<{ item?: MediaItem; size?: number }>;
type MediaRow = ReactElement<{
	children?: MediaChild[];
	style?: { paddingHorizontal?: number };
}>;
type MediaModule = {
	default?: { type: (...args: unknown[]) => unknown };
	SEPARATOR_SIZE?: number;
};

let started = false;
let unpatch: (() => void) | null = null;
let removeModuleListener: (() => boolean) | null = null;

export function formatBytes(bytes: number): string {
	if (!bytes) return '0 Bytes';
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
	return `${Number.parseFloat((bytes / 1024 ** index).toFixed(2))} ${sizes[index]}`;
}

export function sizeBadgesForRow(
	children: MediaChild[],
	padding: number,
	separator: number,
): { key: string; label: string; left: number }[] {
	const badges: { key: string; label: string; left: number }[] = [];
	for (let slot = 0; slot < children.length; slot++) {
		const child = children[slot];
		const bytes = child?.props?.item?.node?.image?.fileSize;
		const size = child?.props?.size;
		if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0) continue;
		if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) continue;
		badges.push({
			key: `file-size-${child.key ?? slot}`,
			label: formatBytes(bytes),
			left: padding + slot * (size + separator) + BADGE_INSET,
		});
	}
	return badges;
}

function patchMediaKeyboard(module: MediaModule | null): boolean {
	if (unpatch) return true;
	if (typeof module?.default?.type !== 'function') return false;

	unpatch = patcher.after(module.default, 'type', (context) => {
		const row = context.result as MediaRow;
		const children = row?.props?.children;
		if (!Array.isArray(children) || !children.length) return;
		const { React, ReactNative, Constants } = metro.common;
		const padding = row.props?.style?.paddingHorizontal;
		const separator = module.SEPARATOR_SIZE;
		const badges = sizeBadgesForRow(
			children,
			typeof padding === 'number' ? padding : 12,
			typeof separator === 'number' ? separator : 4,
		);
		if (!badges.length) return;

		return React.cloneElement(row, {}, [
			...children,
			...badges.map(({ key, label, left }) => (
				<ReactNative.View
					key={key}
					pointerEvents='none'
					style={{
						backgroundColor: '#1e1f2280',
						borderRadius: 4,
						left,
						paddingHorizontal: 4,
						paddingVertical: 2,
						position: 'absolute',
						top: BADGE_INSET,
					}}
				>
					<ReactNative.Text
						style={{
							color: 'white',
							fontFamily: Constants.Fonts.PRIMARY_BOLD,
							fontSize: 10,
							includeFontPadding: false,
						}}
					>
						{label}
					</ReactNative.Text>
				</ReactNative.View>
			)),
		]);
	});
	return true;
}

function waitForMediaKeyboard(): void {
	if (patchMediaKeyboard(metro.findByFilePath(MEDIA_KEYBOARD_ITEM_PATH, { interop: false })))
		return;
	removeModuleListener = metro.addListener(() => {
		if (!started) return;
		if (!patchMediaKeyboard(metro.findByFilePath(MEDIA_KEYBOARD_ITEM_PATH, { interop: false })))
			return;
		removeModuleListener?.();
		removeModuleListener = null;
	});
}

export default {
	start() {
		if (started) return;
		started = true;
		waitForMediaKeyboard();
	},
	stop() {
		started = false;
		unpatch?.();
		unpatch = null;
		removeModuleListener?.();
		removeModuleListener = null;
	},
};
