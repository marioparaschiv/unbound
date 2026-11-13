import { useMemo, memo } from 'react';

import { openThemeEditor } from '~/ui/theme-editor/open-theme-editor';
import { reinstallFromStore } from '~/updates/addon-updates';
import { messages, format } from '~/i18n/api';
import { isLocalTheme } from '~/themes/draft';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

import type { MenuTriggerProps } from './menu-trigger';

import confirmUninstall from './confirm-uninstall';
import useStyles from './round-pill.style';

type AddonOverflowProps = {
	addon: Addon;
	kind: 'plugin' | 'theme' | 'icon-pack';
	developmentCopy?: boolean;
	/** `inline` is the card's small round `IconButton`; `floating` is Discord's large one. */
	variant?: 'inline' | 'floating';
};

/**
 * @description The round overflow (⋯) button of an addon card, opening a menu whose Delete item asks
 * first, then removes the addon, and any plugins that depend on it if asked, through its manager.
 */
function AddonOverflow({ addon, kind, developmentCopy, variant = 'inline' }: AddonOverflowProps) {
	const styles = useStyles();
	const inline = variant === 'inline';
	const manager = Manager.for(kind);
	const navigation = Discord.useNavigation();
	const editable = kind === 'theme' && isLocalTheme(addon.id);

	const items = useMemo(
		() => [
			...(editable
				? [
						{
							label: messages.UNBOUND_EDIT,
							action: () => void openThemeEditor(navigation, addon.id),
						},
					]
				: []),
			...(developmentCopy
				? [
						{
							label: messages.UNBOUND_REINSTALL_FROM_STORE,
							action: () => void reinstall(kind, addon),
						},
					]
				: []),
			{
				label: messages.UNBOUND_DELETE,
				variant: 'destructive',
				action: () => confirmUninstall(manager, addon),
			},
		],
		[manager, navigation, editable, addon, kind, developmentCopy],
	);

	// The menu anchors to the Pressable it renders; wrapping the trigger in a component breaks it.
	return (
		<Discord.ContextMenu title={addon.name} items={items} triggerOnTap>
			{(props: MenuTriggerProps) => (
				<Discord.IconButton
					{...props}
					icon={icons['MoreHorizontalIcon'] ?? 0}
					variant='secondary'
					size={inline ? 'sm' : 'lg'}
					pillStyle={inline ? styles.pill : undefined}
					hitSlop={inline ? 6 : undefined}
					accessibilityLabel={addon.name}
				/>
			)}
		</Discord.ContextMenu>
	);
}

async function reinstall(kind: AddonOverflowProps['kind'], addon: Addon) {
	const name = addon.name;
	let applied = false;

	try {
		applied = await reinstallFromStore(Manager.for(kind), addon.id);
	} catch {
		applied = false;
	}

	show({
		title: name,
		content: format(applied ? 'UNBOUND_REINSTALLED' : 'UNBOUND_REINSTALL_UNCHANGED', { name }),
		icon: applied ? 'CircleCheckIcon' : 'PuzzlePieceIcon',
	});
}

export default memo(AddonOverflow);
