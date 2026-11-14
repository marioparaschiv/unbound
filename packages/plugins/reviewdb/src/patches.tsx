import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { patchAboutCard } from '@unbound-plugins/shared/profile/patch-about-card';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { AboutSection } from '@unbound-plugins/shared/profile/about-section';
import { asId } from '@unbound-plugins/shared/values/as-id';
import { flux, metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { openReviewsSheet } from '~/components/reviews-sheet';
import { UserStore } from '~/lib/modules';

function openReviews(userId: string): void {
	const user = UserStore.getUser(userId);

	openReviewsSheet(userId, user?.globalName ?? user?.username ?? messages.USER);
}

/**
 * @description Adds a Reviews section to profiles' About cards; tapping it opens the user's ReviewDB reviews.
 */
export function patchUserProfileCard(): void {
	const found = patchAboutCard({
		key: 'reviewdb-reviews',
		render: ({ userId }) => (
			<AboutSection
				title={messages.REVIEWS_TITLE}
				icon='StarIcon'
				link
				onPress={() => openReviews(userId)}
			>
				{messages.VIEW_REVIEWS}
			</AboutSection>
		),
	});

	if (!found) logger.warn('Reviews section skipped: Discord moved UserProfileAboutMeCard.');
}

type GuildSheetProps = {
	guild?: { id?: unknown } | null;
	guildId?: unknown;
};

type MenuItem = { label?: string; IconComponent?: unknown; action?: () => void };

type ContextMenuHost = {
	showContextMenu: (menu?: { key?: unknown; items?: MenuItem[] }) => void;
	hideContextMenu: () => void;
};

const GuildStore = flux.getStore('Guild');

function openGuildReviews(guildId: string): void {
	openReviewsSheet(guildId, GuildStore.getGuild(guildId)?.name ?? messages.SERVER_REVIEWS, true);
}

function guildSheetId(key: string, props: GuildSheetProps): string | undefined {
	if (!/^GuildActionSheet:/i.test(key)) return undefined;

	return asId(props.guild?.id) ?? asId(props.guildId) ?? asId(key.slice(key.indexOf(':') + 1));
}

/**
 * @description Adds a Server Reviews row to each server's long-press action sheet, which opens that server's ReviewDB reviews.
 */
export function patchGuildSheet(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Server Reviews row skipped: Discord moved its action sheets.');

		return;
	}

	let open: { key: string; guildId: string } | undefined;

	const { render } = createSheetRenderer(patcher, (result) => {
		const current = open;

		if (!current) return;

		insertSheetRows(result, [
			{
				key: 'reviewdb-server-reviews',
				label: messages.SERVER_REVIEWS,
				icon: 'StarIcon',
				onPress: () => {
					ActionSheets.hideActionSheet(current.key);
					openGuildReviews(current.guildId);
				},
			},
		]);
	});

	patchLazySheets<GuildSheetProps>(patcher, ActionSheets, (key, props) => {
		const guildId = guildSheetId(key, props);

		open = guildId ? { key, guildId } : undefined;

		return guildId ? render : undefined;
	});
}

/**
 * @description Adds a Server Reviews item to each server's context menu, which Android opens on long-press.
 */
export function patchGuildMenu(): void {
	const ContextMenus: ContextMenuHost | undefined = metro.findByProps(
		'showContextMenu',
		'hideContextMenu',
	);
	const Icons = metro.findByProps('StarIcon');

	if (!ContextMenus || !Icons) {
		logger.warn('Server Reviews item skipped: Discord moved showContextMenu or StarIcon.');

		return;
	}

	patcher.before(ContextMenus, 'showContextMenu', ({ args: [menu] }) => {
		const guildId = asId(menu?.key);

		if (!menu || !Array.isArray(menu.items) || !guildId || !GuildStore.getGuild(guildId))
			return;
		if (menu.items.some((item) => item.label === messages.SERVER_REVIEWS)) return;

		menu.items.push({
			label: messages.SERVER_REVIEWS,
			IconComponent: Icons.StarIcon,
			action: () => {
				ContextMenus.hideContextMenu();
				openGuildReviews(guildId);
			},
		});
	});
}
