import type { ContextMenuItem } from '@unbound-app/types/components';
import type { PressableProps } from 'react-native';
import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { useMemo, memo } from 'react';

import type { ManagerKind } from '~/lib/constants';
import { Discord } from '~/api/metro/components';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

import useRoundStyles from './round-button.style';
import confirmDelete from './confirm-delete';

type AddonOverflowProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

/**
 * @description The round overflow (⋯) button of an addon card, opening a menu whose Delete item asks
 * first, then removes the addon, and any plugins that depend on it if asked, through its manager.
 */
function AddonOverflow({ addon, kind }: AddonOverflowProps) {
	const styles = useRoundStyles();
	const manager = getManager(kind);

	const items = useMemo<ContextMenuItem[]>(
		() => [
			{
				label: format('UNBOUND_DELETE'),
				variant: 'destructive',
				action: () => confirmDelete(manager, addon),
			},
		],
		[manager, addon],
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

export default memo(AddonOverflow);
