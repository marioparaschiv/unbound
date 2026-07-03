import type { PressableProps, View } from 'react-native';
import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import type { Ref } from 'react';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Theme } from '~/api/metro/common';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

type AddonOverflowProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

type ContextMenuTriggerProps = PressableProps & {
	ref: Ref<View>;
	onPress: () => void;
	onLongPress: () => void;
};

/**
 * @description The overflow (⋯) menu for an addon card. `Discord.ContextMenu` has no `.Item` static and
 * takes a lazily-invoked `items` builder instead; each entry is a `Discord.MenuItem`, whose destructive
 * styling is driven by a `style` colour (there is no `variant`/`destructive` prop) and whose press
 * handler is `action`, not `onPress`. It builds its own items in the UI and calls plain manager methods;
 * the manager exposes no menu descriptors. Delete removes the addon via `manager.delete(addon.id)`.
 */
function AddonOverflow({ addon, kind }: AddonOverflowProps) {
	const manager = getManager(kind);

	function renderItems() {
		return (
			<Discord.MenuGroup>
				<Discord.MenuItem
					label={format('UNBOUND_DELETE')}
					style={{ color: Theme.colors.TEXT_FEEDBACK_CRITICAL }}
					action={() => manager.delete(addon.id)}
				/>
			</Discord.MenuGroup>
		);
	}

	return (
		<Discord.ContextMenu title={addon.data.name} items={renderItems}>
			{({ onPress, ...rest }: ContextMenuTriggerProps) => (
				<Pressable {...rest} onPress={onPress} hitSlop={8}>
					<TintedIcon source={Icons['MoreHorizontalIcon'] ?? 0} size={20} />
				</Pressable>
			)}
		</Discord.ContextMenu>
	);
}

export default memo(AddonOverflow);
