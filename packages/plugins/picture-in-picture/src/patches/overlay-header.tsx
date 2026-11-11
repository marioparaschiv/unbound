import { getElementName } from '@unbound-plugins/shared/react/find-element';
import { metro, patcher } from '@unbound-app/api';
import { cloneElement, type ComponentType, type ReactElement, type ReactNode } from 'react';

import { insertBeforeLastButton, type CloneElement, type TreeElement } from '~/lib/tree-edit';
import PipButton from '~/components/pip-button';
import { sessions, windowController } from '~/native/window';
import {
	OVERLAY_BUTTON_NAMES,
	OVERLAY_BUTTON_PATH,
	OVERLAY_HEADER_EXPORT,
	OVERLAY_HEADER_PATH,
} from '~/lib/constants';
import type { MediaSource, OverlayButtonProps } from '~/lib/types';

type HeaderProps = { source?: MediaSource };

const clone: CloneElement = (element, props) =>
	cloneElement(element as ReactElement, props) as TreeElement;

function isOverlayButton(Button: ComponentType<OverlayButtonProps>) {
	return (element: TreeElement) => {
		const name = getElementName(element as Parameters<typeof getElementName>[0]);

		return (
			element.type === Button || (name !== undefined && OVERLAY_BUTTON_NAMES.includes(name))
		);
	};
}

function overlayButton(module: object): ComponentType<OverlayButtonProps> | undefined {
	const exported = (module as { default?: unknown }).default;

	return typeof exported === 'function'
		? (exported as ComponentType<OverlayButtonProps>)
		: undefined;
}

/**
 * @description Adds the picture in picture button to the media viewer's header, where Vencord puts it next to the download button.
 * Patches the render of `MediaModalOverlayHeader` and reads `MediaViewerOverlayButton` when the header renders.
 */
export function patchOverlayHeader(): void {
	const controller = windowController();
	const OverlayHeaderModule = metro.findByFilePath(OVERLAY_HEADER_PATH, { interop: false });
	const OverlayButtonModule = metro.findByFilePath(OVERLAY_BUTTON_PATH, { interop: false });

	// `openWindow` runs first and always makes one.
	if (!controller) return;

	if (!OverlayHeaderModule || !OverlayButtonModule) {
		logger.warn(
			'Picture in picture button skipped: Discord moved MediaModalOverlayHeader or MediaViewerOverlayButton.',
		);

		return;
	}

	let reportedMissingRow = false;

	patcher.react.after(OverlayHeaderModule, OVERLAY_HEADER_EXPORT, ({ props, result }) => {
		const Button = overlayButton(OverlayButtonModule);

		if (!Button) return result;

		const button = (
			<PipButton
				key='picture-in-picture'
				source={(props as HeaderProps).source}
				Button={Button}
				sessions={sessions}
				controller={controller}
			/>
		);
		const next = insertBeforeLastButton(result, isOverlayButton(Button), button, clone);

		if (next === undefined && !reportedMissingRow) {
			reportedMissingRow = true;
			logger.warn(
				`Picture in picture button skipped: ${OVERLAY_HEADER_EXPORT} renders no row of buttons.`,
			);
		}

		return (next ?? result) as ReactNode;
	});
}
