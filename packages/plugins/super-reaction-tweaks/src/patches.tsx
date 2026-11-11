import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';
import type { ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

import { DefaultSuperReaction, type BurstToggleProps } from '~/components/default-super-reaction';
import { createPickerSession, type PickerSession } from '~/lib/picker-session';
import { BURST_REACTION_TOGGLE_PATH, PICKER_CLOSE_GRACE_MS } from '~/lib/constants';

function trackUserPress(toggle: BurstToggleProps, session: PickerSession): BurstToggleProps {
	const { onPress } = toggle;

	if (typeof onPress !== 'function') return toggle;

	return {
		...toggle,
		onPress: (...args) => {
			session.pressedByUser();

			return onPress(...args);
		},
	};
}

// Removes this patch alone when the setting turns off, so the toggle comes back as Discord's.
function wrapToggle(): () => void {
	const session = createPickerSession(PICKER_CLOSE_GRACE_MS);
	let unpatch: (() => void) | undefined;

	const stopWaiting = metro.onModuleLoaded(
		metro.filters.byFilePath(BURST_REACTION_TOGGLE_PATH),
		(module) => {
			const target = findRenderTarget(module);

			if (!target) return;

			unpatch = patcher.instead(
				target.holder,
				target.key,
				({ args, original, this: self }) => {
					const [props, ...rest] = args as [BurstToggleProps | undefined, ...unknown[]];
					const toggle = props ?? {};
					const result = original.apply(self, [trackUserPress(toggle, session), ...rest]);

					return (
						<DefaultSuperReaction
							isActive={toggle.isActive}
							onPress={toggle.onPress}
							session={session}
						>
							{result as ReactNode}
						</DefaultSuperReaction>
					);
				},
			);
		},
		{
			onMissing: () =>
				logger.warn('Super Reaction default skipped: Discord moved BurstReactionToggle.'),
		},
	);

	return () => {
		stopWaiting();
		unpatch?.();
		session.reset();
	};
}

/**
 * @description Makes the reaction picker open on Super Reactions while `superReactByDefault` is on, by wrapping the picker's
 * `BurstReactionToggle` so it turns itself on once per picker, unless the user switches it.
 */
export function patchBurstReactionToggle(): void {
	whileEnabled('superReactByDefault', wrapToggle);
}
