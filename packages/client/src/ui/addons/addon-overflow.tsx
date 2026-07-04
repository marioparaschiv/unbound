import type { Addon } from '@unbound-app/types';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { useMemo, memo } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

type AddonOverflowProps = {
	addon: Addon;
	kind: ManagerKind.Plugins | ManagerKind.Themes | ManagerKind.Icons;
};

type ContextMenuTriggerProps = ComponentProps<typeof Pressable>;

/**
 * @description The overflow (⋯) menu for an addon card. `Discord.ContextMenu` renders an anchored
 * popover: `children` is a render function that receives the trigger props (ref/onPress/…), and `items`
 * is an array of `{ label, action, variant }` descriptors (not a render function). Tapping the ⋯ opens
 * the menu; the Delete item removes the addon via `manager.delete(addon.id)` and is styled destructive.
 */
function AddonOverflow({ addon, kind }: AddonOverflowProps) {
	const manager = getManager(kind);

	const items = useMemo(
		() => [
			{
				label: format('UNBOUND_DELETE'),
				variant: 'destructive',
				action: () => manager.delete(addon.id),
			},
		],
		[manager, addon.id],
	);

	return (
		<Discord.ContextMenu title={addon.data.name} items={items} triggerOnTap>
			{(props: ContextMenuTriggerProps) => (
				<Pressable {...props} hitSlop={8}>
					<TintedIcon source={Icons['MoreHorizontalIcon'] ?? 0} size={20} />
				</Pressable>
			)}
		</Discord.ContextMenu>
	);
}

export default memo(AddonOverflow);
