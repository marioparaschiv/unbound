import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';

import { roleTag, topRole, type Role } from '~/lib/roles';

type RoleChip = { id: string; name: string; backgroundColor: number; iconColor: number };
type RowMessage = { guildId?: string; authorId?: string; connectionsRoleTag?: RoleChip | null };
type Row = { message?: RowMessage };
type ChatManagerClass = { prototype?: { createRow(...args: unknown[]): unknown } };
type MemberStore = { getMember(guildId: string, userId: string): { roles?: string[] } | null };
type RoleStore = {
	getRole(
		guildId: string,
		roleId: string,
	): (Role & { tags?: { guild_connections?: unknown } }) | undefined;
};
type SheetProps = { guildId?: string; roleId?: string; role?: { id?: string } };

const LINKED_ROLE_SHEET = 'ConnectionsRoleMessageBadgeActionSheet';

function isOrdinaryRole(props: SheetProps | undefined): boolean {
	const roleId = props?.roleId ?? props?.role?.id;

	if (!props?.guildId || !roleId) return false;

	const role = (flux.getStore('GuildRole') as unknown as RoleStore).getRole(
		props.guildId,
		roleId,
	);

	return Boolean(role) && role!.tags?.guild_connections === undefined;
}

function patchRoleSheet() {
	const { ActionSheets } = metro.api;

	if (!ActionSheets?.openLazy) return;

	patcher.instead(ActionSheets, 'openLazy', ({ args, original }) => {
		if (args[1] === LINKED_ROLE_SHEET && isOrdinaryRole(args[2] as SheetProps | undefined))
			return;

		return original(...args);
	});
}

function withRoleTag(row: Row): void {
	const message = row?.message;

	if (!message?.guildId || !message.authorId || message.connectionsRoleTag) return;

	const member = (flux.getStore('GuildMember') as unknown as MemberStore).getMember(
		message.guildId,
		message.authorId,
	);
	const roles = flux.getStore('GuildRole') as unknown as RoleStore;
	const role = topRole(
		(member?.roles ?? []).map((id) => roles.getRole(message.guildId!, id)),
		settings.coloredOnly,
	);

	if (!role) return;

	const tag = roleTag(role);

	message.connectionsRoleTag = {
		id: role.id,
		name: tag.text,
		backgroundColor: tag.backgroundColor,
		iconColor: tag.backgroundColor,
	};
}

export function start() {
	patchRoleSheet();

	if (!metro.findByName('ChatManager')) {
		logger.warn('Show roles in chat skipped: Discord moved ChatManager.');

		return;
	}

	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager: ChatManagerClass) => {
		const { prototype } = ChatManager;

		if (typeof prototype?.createRow !== 'function') {
			logger.warn('Show roles in chat skipped: Discord moved ChatManager.createRow.');

			return;
		}

		patcher.after(prototype, 'createRow', ({ result }) => {
			try {
				withRoleTag(result as Row);
			} catch (error) {
				logger.error('Failed to add a role tag to a chat row:', error);
			}
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
