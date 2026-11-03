import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import type { ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import { DefaultSuperReaction, type BurstToggleProps } from '~/components/default-super-reaction';
import { createPickerSession, type PickerSession } from '~/picker-session';
import { BURST_REACTION_TOGGLE_PATH, PICKER_CLOSE_GRACE_MS } from '~/constants';

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

/**
 * @description Makes the reaction picker open on Super Reactions, by wrapping the picker's `BurstReactionToggle` so it turns itself on once per picker, unless the user switches it.
 * @returns A function that stops waiting for the toggle's module and removes the patch.
 */
export function patchBurstReactionToggle(): () => void {
	const session = createPickerSession(PICKER_CLOSE_GRACE_MS);

	const stopWaiting = whenLoaded<AnyProps>(BURST_REACTION_TOGGLE_PATH, (module) => {
		const target = findRenderTarget(module);

		if (!target) return;

		return patcher.instead(target.holder, target.key, ({ args, original, this: self }) => {
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
		});
	});

	return () => {
		stopWaiting();
		session.reset();
	};
}

export default patchBurstReactionToggle;
