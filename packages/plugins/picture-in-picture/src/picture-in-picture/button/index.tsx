import { getElementName } from '@unbound-plugins/shared/react/find-element';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { patcher } from '@unbound-app/api';
import { cloneElement, type ComponentType, type ReactElement, type ReactNode } from 'react';

import {
	insertBeforeLastButton,
	type CloneElement,
	type TreeElement,
} from '~/picture-in-picture/tree/edit';
import {
	overlayButton,
	OverlayHeaderModule,
	type OverlayButtonProps,
} from '~/picture-in-picture/button/modules';
import PipButton from '~/picture-in-picture/button/components/pip-button';
import type { Controller } from '~/picture-in-picture/session/controller';
import type { SessionStore } from '~/picture-in-picture/session/store';
import { OVERLAY_BUTTON_NAMES, OVERLAY_HEADER_EXPORT, PLUGIN_NAME } from '~/constants';
import type { MediaSource } from '~/types';

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

function skip(reason: string) {
	console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
	recordSkip(reason);
}

/**
 * @description Adds the picture in picture button to the media viewer's header, where Vencord puts it next to the download button.
 * @param sessions The session store the button reads its state from.
 * @param controller The controller the button toggles.
 */
export function patchOverlayHeader(
	sessions: SessionStore<string>,
	controller: Controller<string>,
): void {
	let reportedMissingRow = false;

	patcher.react.after(OverlayHeaderModule, OVERLAY_HEADER_EXPORT, ({ props, result }) => {
		const Button = overlayButton();

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
			skip(`${OVERLAY_HEADER_EXPORT} renders no row of buttons`);
		}

		return (next ?? result) as ReactNode;
	});
}
