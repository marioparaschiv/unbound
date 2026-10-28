import type { ContextMenuItem } from '@unbound-app/types/components';
import type { PressableProps } from 'react-native';
import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { useMemo, memo } from 'react';

import { openThemeEditor } from '~/ui/theme-editor/open-theme-editor';
import { isLocalThemeId } from '~/lib/local-themes';
import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
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
	const localId = kind === ManagerKind.Themes && isLocalThemeId(addon.id) ? addon.id : undefined;

	const items = useMemo<ContextMenuItem[]>(
		() => [
			...(localId
				? [
						{
							label: format('UNBOUND_EDIT'),
							action: () => openThemeEditor(navigation, localId),
						},
					]
				: []),
			{
				label: format('UNBOUND_DELETE'),
				variant: 'destructive',
				action: () => void manager.delete(addon.id),
			},
		],
		[manager, navigation, localId, addon.id],
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
