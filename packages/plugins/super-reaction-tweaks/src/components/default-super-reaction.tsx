import { useEffect, useRef, type ReactNode } from 'react';

import type { PickerSession } from '~/picker-session';
import { canSuperReact } from '~/settings';
import { UserStore } from '~/modules';

type PremiumUser = { premiumType?: unknown };

export type BurstToggleProps = {
	isActive?: boolean;
	onPress?: (...args: unknown[]) => unknown;
};

function wantsSuperReaction(): boolean {
	const user = UserStore.getCurrentUser?.() as PremiumUser | undefined;

	return canSuperReact(user?.premiumType);
}

/**
 * @description Switches the reaction picker's Super Reaction toggle on once per picker, when the picker opens with it off and the user has not switched it yet.
 * @param props The toggle's state, its unwrapped press handler, the picker session, and the toggle Discord rendered.
 * @returns The toggle.
 */
export function DefaultSuperReaction({
	isActive,
	onPress,
	session,
	children,
}: BurstToggleProps & { session: PickerSession; children: ReactNode }) {
	const latest = useRef({ isActive, onPress });

	latest.current = { isActive, onPress };

	useEffect(() => {
		session.mount(Date.now());

		const toggle = latest.current;

		if (
			typeof toggle.onPress === 'function' &&
			wantsSuperReaction() &&
			session.claimAutoEnable(toggle.isActive)
		)
			toggle.onPress();

		return () => session.unmount(Date.now());
	}, [session]);

	return children;
}

export default DefaultSuperReaction;
