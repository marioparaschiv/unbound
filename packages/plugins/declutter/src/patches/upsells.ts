import type { AnyProps } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { withoutMessageClutter, type MessageContent } from '~/lib/message-clutter';
import { blockedSetting } from '~/lib/premium-settings';
import { whenLoaded } from '~/lib/when-loaded';

type SegmentedItems = { items?: { id?: unknown }[] };

const PROFILE_TABS = new Set(['wishlist', 'board', 'activity']);

function hidesProfileTab(item: { id?: unknown } | undefined): boolean {
	return PROFILE_TABS.has(String(item?.id));
}

/**
 * @description Hides Nitro, Shop, Quests and the other payment pages from User Settings, by patching `isBlocked` on Discord's `SettingTreeManager`.
 */
export function patchPremiumSettings(): void {
	whenLoaded({ path: 'modules/settings/native/renderer/SettingTreeManager.tsx' }, (module) => {
		const manager: AnyProps | undefined = module.default;

		if (typeof manager?.isBlocked !== 'function') return;

		patcher.instead(
			manager,
			'isBlocked',
			({ args, original, this: self }) =>
				blockedSetting(args[0], settings) || original.apply(self, args),
		);
	});
}

function patchSegmentedControl(SegmentedControl: AnyProps) {
	if (typeof SegmentedControl.useSegmentedControlState !== 'function') return;

	patcher.before(SegmentedControl, 'useSegmentedControlState', ({ args }) => {
		const options: SegmentedItems | undefined = args[0];
		const items = options?.items;

		if (!settings.wishlist || !Array.isArray(items) || !items.some(hidesProfileTab)) return;

		return [{ ...options, items: items.filter((item) => !hidesProfileTab(item)) }];
	});
}

/**
 * @description Hides the Wishlist, Board and Activity tabs on profiles, by patching Discord's `useSegmentedControlState`.
 */
export function patchProfileTabs(): void {
	whenLoaded(
		{ path: 'design/components/SegmentedControl/native/SegmentedControlState.native.tsx' },
		patchSegmentedControl,
	);
}

function patchCreateMessageContent(module: AnyProps) {
	if (typeof module.default !== 'function') return;

	patcher.after(module, 'default', ({ result }) =>
		result
			? withoutMessageClutter(result as MessageContent, {
					avatarDecorations: settings.avatarDecorations,
					serverTags: settings.serverTags,
					displayNameStyles: settings.displayNameStyles,
				})
			: result,
	);
}

/**
 * @description Clears avatar decorations, server tags and display name styles from chat rows, by patching Discord's `createMessageContent`.
 */
export function patchMessageContent(): void {
	whenLoaded(
		{ path: 'modules/messages/native/renderer/createMessageContent.tsx' },
		patchCreateMessageContent,
	);
}
