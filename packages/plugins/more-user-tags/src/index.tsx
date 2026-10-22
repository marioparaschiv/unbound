import { createTagGradientRenderer } from '@more-user-tags/tag-gradient-renderer';
import {
	getContrastingTextColor,
	getRoleColorAppearance,
	type RoleColorAppearance,
} from '@shared/role-colors';

import { SettingsScrollView, SettingsSection, SettingsSwitchRow } from '@shared/settings-ui';
import { metro, patcher, storage } from '@unbound-app/api';
import type { PluginContext } from '@unbound-app/api/native';

const ADDON_ID = 'unbound.more-user-tags';
const STORE = storage.getStore(ADDON_ID);

type PermissionName =
	| 'ADMINISTRATOR'
	| 'MANAGE_GUILD'
	| 'MANAGE_CHANNELS'
	| 'MANAGE_ROLES'
	| 'MANAGE_WEBHOOKS'
	| 'MANAGE_MESSAGES'
	| 'KICK_MEMBERS'
	| 'BAN_MEMBERS'
	| 'MOVE_MEMBERS'
	| 'MUTE_MEMBERS'
	| 'DEAFEN_MEMBERS';

interface TagDefinition {
	name: string;
	displayName: string;
	description: string;
	color: string;
	permissions?: PermissionName[];
	condition?: (message: any, user: any, guild: any) => boolean;
}

const TAGS: TagDefinition[] = [
	{
		name: 'WEBHOOK',
		color: '#5865F2',
		displayName: 'Webhook',
		description: 'Messages sent by webhooks',
		condition: (message, user) => Boolean(message?.webhookId) && Boolean(user?.bot),
	},
	{
		name: 'OWNER',
		color: '#F0B232',
		displayName: 'Owner',
		description: 'Owns the server',
		condition: (_message, user, guild) => Boolean(guild) && guild.ownerId === user?.id,
	},
	{
		name: 'ADMINISTRATOR',
		color: '#DA373C',
		displayName: 'Admin',
		description: 'Has the administrator permission',
		permissions: ['ADMINISTRATOR'],
	},
	{
		name: 'MODERATOR_STAFF',
		color: '#248046',
		displayName: 'Staff',
		description: 'Can manage the server, channels or roles',
		permissions: ['MANAGE_GUILD', 'MANAGE_CHANNELS', 'MANAGE_ROLES', 'MANAGE_WEBHOOKS'],
	},
	{
		name: 'MODERATOR',
		color: '#4E7FFF',
		displayName: 'Mod',
		description: 'Can manage messages or kick/ban people',
		permissions: ['MANAGE_MESSAGES', 'KICK_MEMBERS', 'BAN_MEMBERS'],
	},
	{
		name: 'VOICE_MODERATOR',
		color: '#059669',
		displayName: 'VC Mod',
		description: 'Can manage voice chats',
		permissions: ['MOVE_MEMBERS', 'MUTE_MEMBERS', 'DEAFEN_MEMBERS'],
	},
];

let unpatch: (() => void) | null = null;
let tagGradientRenderer: ReturnType<typeof createTagGradientRenderer> = null;
let permissionBits: Record<string, bigint> | null = null;
let computePermissions: ((options: any) => bigint) | null = null;
let guilds: any = null;
let channels: any = null;
let members: any = null;

function isTagEnabled(name: string): boolean {
	return STORE.get(`tag.${name}`, true);
}

function resolveColors(tag: TagDefinition, guild: any, user: any): RoleColorAppearance {
	if (STORE.get('useRoleColor', true) && guild && members) {
		const member = members.getMember?.(guild.id, user?.id);
		if (member) {
			const appearance = getRoleColorAppearance(
				member.colorStrings,
				member.colorString,
				STORE.get('useEnhancedRoleColors', true),
			);
			if (appearance.colors.length > 0) return appearance;
		}
	}

	return {
		colors: STORE.get('coloredTags', true) ? [tag.color] : [],
		style: 'solid',
	};
}

function hasPermission(user: any, guild: any, channel: any, names: PermissionName[]): boolean {
	if (!guild || !computePermissions || !permissionBits) return false;

	let total: bigint;
	try {
		total = computePermissions({
			user,
			context: guild,
			overwrites: channel?.permissionOverwrites,
		});
	} catch {
		return false;
	}

	return names.some((name) => {
		const bit = permissionBits![name];
		return typeof bit === 'bigint' && (total & bit) === bit;
	});
}

function resolveTag(message: any, user: any, guild: any, channel: any): TagDefinition | null {
	for (const tag of TAGS) {
		if (!isTagEnabled(tag.name)) continue;

		if (tag.condition?.(message, user, guild)) return tag;
		if (!user?.bot && tag.permissions && hasPermission(user, guild, channel, tag.permissions)) {
			return tag;
		}
	}

	return null;
}

function MoreUserTagsSettings() {
	const state = STORE.useSettingsStore();

	return (
		<SettingsScrollView>
			<SettingsSection title='Tags'>
				{TAGS.map((tag) => (
					<SettingsSwitchRow
						key={tag.name}
						label={tag.displayName}
						description={tag.description}
						value={state.get(`tag.${tag.name}`, true)}
						onValueChange={(value: boolean) => state.set(`tag.${tag.name}`, value)}
					/>
				))}
			</SettingsSection>

			<SettingsSection title='Appearance'>
				<SettingsSwitchRow
					label='Coloured Tags'
					description='Give each tag its own colour instead of the default styling'
					value={state.get('coloredTags', true)}
					onValueChange={(value: boolean) => state.set('coloredTags', value)}
				/>
				<SettingsSwitchRow
					label='Use Role Colour'
					description="Colour tags with the member's role colour where they have one"
					value={state.get('useRoleColor', true)}
					onValueChange={(value: boolean) => state.set('useRoleColor', value)}
				/>
				<SettingsSwitchRow
					label='Use Enhanced Role Colours'
					description='Use gradient and holographic role colours across all generated tags when available'
					value={state.get('useEnhancedRoleColors', true)}
					onValueChange={(value: boolean) => state.set('useEnhancedRoleColors', value)}
				/>
				<SettingsSwitchRow
					label='Use Original Poster Tag Style'
					description='Show staff tags with Discord’s original poster badge styling'
					value={state.get('useOpTagStyle', false)}
					onValueChange={(value: boolean) => state.set('useOpTagStyle', value)}
				/>
			</SettingsSection>
		</SettingsScrollView>
	);
}

export default {
	start(context: PluginContext) {
		unpatch?.();
		void tagGradientRenderer?.stop().catch(() => {});
		unpatch = null;
		tagGradientRenderer = null;

		permissionBits =
			(metro.findByProps('Permissions', 'ThemeTypes') as any)?.Permissions ?? null;
		computePermissions =
			(metro.findByProps('computePermissions', 'canEveryoneRole') as any)
				?.computePermissions ?? null;
		guilds = metro.findStore('Guild');
		channels = metro.findStore('Channel');
		members = metro.findStore('GuildMember');

		if (!permissionBits || !computePermissions || !guilds || !channels) return;

		const target = metro.findByName('getTagProperties', { interop: false }) as any;
		if (typeof target?.default !== 'function') return;
		tagGradientRenderer = createTagGradientRenderer(context);

		unpatch = patcher.after(target, 'default', (ctx) => {
			try {
				const result = ctx.result as any;
				if (!result) return;

				const message = (ctx.args[0] as any)?.message;
				const user = message?.author;
				if (!user) return;

				const channel = channels.getChannel(message.channel_id);
				const guild = channel?.guild_id ? guilds.getGuild(channel.guild_id) : null;

				const tag = resolveTag(message, user, guild, channel);
				if (!tag) return;

				const appearance = resolveColors(tag, guild, user);
				const { colors } = appearance;
				const background = colors[0];
				const { processColor } = metro.common.ReactNative;
				const useOpTagStyle = STORE.get('useOpTagStyle', false);
				const tagText = result.opTagText
					? `${result.opTagText} · ${tag.displayName}`
					: tag.displayName;
				if (useOpTagStyle) {
					const tagged = {
						...result,
						tagText: null,
						tagAccessibilityLabel: tagText,
						tagVerified: false,
						tagTextColor: null,
						tagBackgroundColor: null,
						tagType: null,
						tagIconUrl: null,
						opTagText: tagText,
					};
					tagGradientRenderer?.setAppearance([tagText], appearance);
					if (!background) return tagged;
					return {
						...tagged,
						opTagBackgroundColor: processColor(background),
						opTagTextColor: processColor(getContrastingTextColor(colors)),
					};
				}
				const tagged = {
					...result,
					opTagText: null,
					opTagBackgroundColor: null,
					opTagTextColor: null,
					tagText,
					tagAccessibilityLabel: tagText,
					tagVerified: false,
				};
				tagGradientRenderer?.setAppearance([tagText], appearance);
				if (!background) return tagged;

				return {
					...tagged,
					tagBackgroundColor: processColor(background),
					tagTextColor: processColor(getContrastingTextColor(colors)),
				};
			} catch {}
		});
	},

	async stop() {
		unpatch?.();
		await tagGradientRenderer?.stop();
		unpatch = null;
		tagGradientRenderer = null;
		permissionBits = null;
		computePermissions = null;
		guilds = null;
		channels = null;
		members = null;
	},
	getSettingsPanel: () => <MoreUserTagsSettings />,
};
