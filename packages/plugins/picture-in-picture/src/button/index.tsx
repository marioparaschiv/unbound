import { getElementName } from '@unbound-plugins/shared/react/find-element';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { patcher } from '@unbound-app/api';
import { cloneElement, type ComponentType, type ReactElement } from 'react';

import { insertBeforeLastButton, type CloneElement, type TreeElement } from '~/tree/edit';
import { overlayButton, type OverlayButtonProps } from '~/button/modules';
import PipButton from '~/button/components/pip-button';
import type { PlayerRegistry } from '~/players/registry';
import type { Controller } from '~/session/controller';
import type { SessionStore } from '~/session/store';
import {
	OVERLAY_BUTTON_NAMES,
	OVERLAY_HEADER_EXPORT,
	OVERLAY_HEADER_PATH,
	PLUGIN_NAME,
} from '~/constants';
import type { MediaSource, VideoInstance } from '~/types';

type HeaderModule = Record<string, unknown>;

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
 * @param players The registry the button finds its player in.
 * @param sessions The session store the button reads its state from.
 * @param controller The controller the button toggles.
 * @returns A function that stops waiting for the header and removes the patch.
 */
export function patchOverlayHeader(
	players: PlayerRegistry,
	sessions: SessionStore<VideoInstance>,
	controller: Controller<VideoInstance>,
): () => void {
	let reportedMissingRow = false;

	return whenLoaded<HeaderModule>(OVERLAY_HEADER_PATH, (module) => {
		if (typeof module[OVERLAY_HEADER_EXPORT] !== 'function') {
			skip(`${OVERLAY_HEADER_EXPORT} is not a component`);

			return;
		}

		return patcher.after(
			module as Record<string, (props: HeaderProps) => unknown>,
			OVERLAY_HEADER_EXPORT,
			({ args, result }) => {
				const Button = overlayButton();

				if (!Button) return result;

				const button = (
					<PipButton
						key='picture-in-picture'
						source={args[0]?.source}
						Button={Button}
						players={players}
						sessions={sessions}
						controller={controller}
					/>
				);
				const next = insertBeforeLastButton(result, isOverlayButton(Button), button, clone);

				if (next === undefined && !reportedMissingRow) {
					reportedMissingRow = true;
					skip(`${OVERLAY_HEADER_EXPORT} renders no row of buttons`);
				}

				return next ?? result;
			},
		);
	});
}
