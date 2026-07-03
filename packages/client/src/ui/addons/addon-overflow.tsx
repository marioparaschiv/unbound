import type { GestureResponderEvent } from 'react-native';
import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { findByProps } from '~/api/metro';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

type AddonOverflowProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

/**
 * @description The overflow (⋯) menu for an addon card. Discord's context menu is opened
 * imperatively via `openContextMenu(event, renderMenu)` - there is no render-prop or `.Item` static
 * form; that contract throws `undefined is not a function` when mounted. `renderMenu` returns a
 * `Discord.Menu` wrapping a single `Discord.MenuItem`, whose destructive styling is driven by a
 * `style` colour (there is no `variant`/`destructive` prop) and whose press handler is `action`, not
 * `onPress`. Delete removes the addon via `manager.delete(addon.id)`.
 */
function AddonOverflow({ addon, kind }: AddonOverflowProps) {
	const manager = getManager(kind);

	function renderMenu() {
		return (
			<Discord.Menu title={addon.data.name}>
				<Discord.MenuItem
					label={format('UNBOUND_DELETE')}
					style={{ color: Theme.colors.TEXT_FEEDBACK_CRITICAL }}
					action={() => manager.delete(addon.id)}
				/>
			</Discord.Menu>
		);
	}

	function open(event: GestureResponderEvent) {
		const { openContextMenu } = findByProps('openContextMenu', 'openContextMenuLazy');

		openContextMenu(event, renderMenu);
	}

	return (
		<Pressable onPress={open} hitSlop={8}>
			<TintedIcon source={Icons['MoreHorizontalIcon'] ?? 0} size={20} />
		</Pressable>
	);
}

export default memo(AddonOverflow);
