import type { ContextMenuItem } from '@unbound-app/types/components';
import type { PressableProps } from 'react-native';
import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { useMemo, memo } from 'react';

import { API_URL, CLIENT_VERSION } from '~/lib/constants';
import type { ManagerKind } from '~/lib/constants';
import { reinstallFromStore } from '~/lib/updates';
import { Discord } from '~/api/metro/components';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { showToast } from '~/api/toasts';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

import useRoundStyles from './round-button.style';
import confirmDelete from './confirm-delete';

type AddonOverflowProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
	developmentCopy?: boolean;
};

/**
 * @description The round overflow (⋯) button of an addon card, opening a menu whose Delete item asks
 * first, then removes the addon, and any plugins that depend on it if asked, through its manager.
 */
function AddonOverflow({ addon, kind, developmentCopy }: AddonOverflowProps) {
	const styles = useRoundStyles();
	const manager = getManager(kind);

	const items = useMemo<ContextMenuItem[]>(
		() => [
			...(developmentCopy
				? [
						{
							label: format('UNBOUND_REINSTALL_FROM_STORE'),
							action: () => void reinstall(kind, addon),
						},
					]
				: []),
			{
				label: format('UNBOUND_DELETE'),
				variant: 'destructive',
				action: () => confirmDelete(manager, addon),
			},
		],
		[manager, addon, kind, developmentCopy],
	);

	// The menu anchors to the Pressable it renders; wrapping the trigger in a component breaks it.
	return (
		<Discord.ContextMenu title={addon.data.name} items={items} triggerOnTap>
			{(props: PressableProps) => (
				<Pressable {...props} hitSlop={6} style={styles.button}>
					<TintedIcon
						source={Icons['MoreHorizontalIcon'] ?? 0}
						size={16}
						tint={Theme.colors.CONTROL_SECONDARY_TEXT_DEFAULT}
					/>
				</Pressable>
			)}
		</Discord.ContextMenu>
	);
}

async function reinstall(kind: AddonOverflowProps['kind'], addon: Addon) {
	const name = addon.data.name;
	let applied = false;

	try {
		applied = await reinstallFromStore(kind, getManager(kind), addon.id, {
			baseUrl: API_URL,
			clientVersion: CLIENT_VERSION,
		});
	} catch {
		applied = false;
	}

	showToast({
		title: name,
		content: format(applied ? 'UNBOUND_REINSTALLED' : 'UNBOUND_REINSTALL_UNCHANGED', { name }),
		icon: applied ? 'CircleCheckIcon' : 'PuzzlePieceIcon',
	});
}

export default memo(AddonOverflow);
