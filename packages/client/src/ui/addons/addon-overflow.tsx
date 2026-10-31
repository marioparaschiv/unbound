import type { PressableProps } from 'react-native';
import { Pressable } from 'react-native';
import { useMemo, memo } from 'react';

import { reinstallFromStore } from '~/updates/addon-updates';
import { API_URL, CLIENT_VERSION } from '~/core/constants';
import { Discord } from '~/metro/components';
import { TintedIcon } from '~/ui/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { showToast } from '~/toasts/api';
import { Theme } from '~/metro/common';
import { Icons } from '~/assets/api';
import { format } from '~/i18n/api';

import useRoundStyles from './round-button.style';
import confirmDelete from './confirm-delete';

type AddonOverflowProps = {
	addon: Addon;
	kind: 'plugin' | 'theme' | 'icon-pack';
	developmentCopy?: boolean;
};

/**
 * @description The round overflow (⋯) button of an addon card, opening a menu whose Delete item asks
 * first, then removes the addon, and any plugins that depend on it if asked, through its manager.
 */
function AddonOverflow({ addon, kind, developmentCopy }: AddonOverflowProps) {
	const styles = useRoundStyles();
	const manager = Manager.for(kind);

	const items = useMemo(
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
		<Discord.ContextMenu title={addon.name} items={items} triggerOnTap>
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
	const name = addon.name;
	let applied = false;

	try {
		applied = await reinstallFromStore(Manager.for(kind), addon.id, {
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
