import {
	insertBeforeLastButton,
	type CloneElement,
	type TreeElement,
} from '@unbound-plugins/shared/media-viewer/tree-edit';
import { getElementName } from '@unbound-plugins/shared/react/find-element';
import { cloneElement, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { assets, metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import type { AirPlay } from '~/native/ios/airplay';

const OVERLAY_HEADER_PATH =
	'modules/media_viewer/native/components/overlay/MediaModalOverlayHeader.tsx';
const OVERLAY_BUTTON_PATH =
	'modules/media_viewer/native/components/overlay/MediaViewerOverlayButton.tsx';
const OVERLAY_HEADER_EXPORT = 'MediaModalOverlayHeader';
const OVERLAY_BUTTON_NAMES = ['MediaViewerOverlayButton', 'GIFFavButton'];
const ICON_NAMES = ['ScreenStreamIcon', 'TvIcon', 'ScreenIcon'];
const VIDEO = /\.(mp4|m4v|mov|webm)(\?|$)/i;

type OverlayButtonProps = { icon?: number; onPress?: () => void; accessibilityLabel?: string };

type MediaSource = { uri?: unknown; sourceURI?: unknown; videoURI?: unknown; isGIFV?: unknown };

const clone: CloneElement = (element, props) =>
	cloneElement(element as ReactElement, props) as TreeElement;

function isVideo(source: MediaSource | undefined): boolean {
	if (!source || source.isGIFV) return false;

	return [source.videoURI, source.sourceURI, source.uri].some(
		(uri) => typeof uri === 'string' && (uri === source.videoURI || VIDEO.test(uri)),
	);
}

function airPlayIcon(): number | undefined {
	return ICON_NAMES.map((name) => assets.getIdByName(name)).find((id) => id !== undefined);
}

function overlayButton(module: object): ComponentType<OverlayButtonProps> | undefined {
	const exported = (module as { default?: unknown }).default;

	return typeof exported === 'function'
		? (exported as ComponentType<OverlayButtonProps>)
		: undefined;
}

async function pick(airPlay: AirPlay) {
	const result = await airPlay.pick();

	if (result === 'no-video') toasts.warning('NO_VIDEO');
	else if (result === 'failed')
		toasts.error('FAILED', new Error('the AirPlay picker did not open'));
}

/**
 * @description Adds an AirPlay button to the media viewer's header for videos, next to Discord's own buttons.
 * @param airPlay The AirPlay controller.
 */
export function patchOverlayHeader(airPlay: AirPlay): void {
	const Header = metro.findByFilePath(OVERLAY_HEADER_PATH, { interop: false });
	const ButtonModule = metro.findByFilePath(OVERLAY_BUTTON_PATH, { interop: false });

	if (!Header || !ButtonModule) {
		logger.warn('AirPlay button skipped: Discord moved the media viewer header.');

		return;
	}

	patcher.react.after(Header, OVERLAY_HEADER_EXPORT, ({ props, result }) => {
		const Button = overlayButton(ButtonModule);

		if (!Button || !isVideo((props as { source?: MediaSource }).source)) return result;

		const isButton = (element: TreeElement) => {
			const name = getElementName(element as Parameters<typeof getElementName>[0]);

			return (
				element.type === Button ||
				(name !== undefined && OVERLAY_BUTTON_NAMES.includes(name))
			);
		};
		const button = (
			<Button
				key='airplay'
				icon={airPlayIcon()}
				accessibilityLabel={messages.AIRPLAY}
				onPress={() => void pick(airPlay)}
			/>
		);

		return (insertBeforeLastButton(result, isButton, button, clone) ?? result) as ReactNode;
	});
}
