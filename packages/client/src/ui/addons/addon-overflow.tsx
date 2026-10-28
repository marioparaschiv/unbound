import type { ContextMenuItem } from '@unbound-app/types/components';
import type { PressableProps } from 'react-native';
import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { useMemo, memo } from 'react';

import { ManagerKind, Screens } from '~/lib/constants';
import { Discord } from '~/api/metro/components';
import { isLocalThemeId } from '~/lib/local-themes';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

import useRoundStyles from './round-button.style';

type AddonOverflowProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

/**
 * @description The round overflow (⋯) button of an addon card, opening a menu whose Delete item removes
 * the addon through its manager. Themes made in the theme editor also get an Edit item.
 */
function AddonOverflow({ addon, kind }: AddonOverflowProps) {
	const styles = useRoundStyles();
	const navigation = Discord.useNavigation();
	const manager = getManager(kind);
	const editable = kind === ManagerKind.Themes && isLocalThemeId(addon.id);

	const items = useMemo<ContextMenuItem[]>(
		() => [
			...(editable
				? [
						{
							label: format('UNBOUND_EDIT'),
							action: () => navigation.push(Screens.ThemeEditor, { id: addon.id }),
						},
					]
				: []),
			{
				label: format('UNBOUND_DELETE'),
				variant: 'destructive',
				action: () => void manager.delete(addon.id),
			},
		],
		[manager, navigation, editable, addon.id],
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
