import { flux, metro } from '@unbound-app/api/testing';
import { mock } from 'bun:test';
import { Text, View } from 'react-native';

// Lookups stay resolved across test files, so every file shares these modules.
export const opened: unknown[] = [];
export const hidden: string[] = [];

export function ActionSheetRow({ label, onPress }: { label: string; onPress?: () => void }) {
	return (
		<Text accessibilityLabel={label} onPress={onPress}>
			{label}
		</Text>
	);
}
ActionSheetRow.Icon = function Icon(_props: { source: number }) {
	return <View />;
};

// The testing kit cannot serve `@unbound-app/api/metro/components` yet, so the pieces the plugin reads are stubbed here.
mock.module('@unbound-app/api/metro/components', () => ({
	Media: { openMediaModal: (options: unknown) => void opened.push(options) },
	Discord: { createStyles: (factory: () => unknown) => factory },
	BottomSheets: { ActionSheetRow },
}));

export const ContextMenus = {
	showContextMenu: (_menu?: unknown) => {},
	hideContextMenu: () => void hidden.push('menu'),
};

export const ActionSheets = {
	openLazy: (_sheet?: Promise<unknown>, _key?: unknown, _props?: unknown) => {},
	hideActionSheet: (key: string) => void hidden.push(key),
};

const IconUtils = {
	getUserAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/abc.png',
	getUserBannerURL: () => 'https://cdn.discordapp.com/banners/1/def.png',
	getGuildIconURL: () => 'https://cdn.discordapp.com/icons/2/ghi.png',
	getGuildBannerURL: () => null,
	getChannelIconURL: () => null,
	getGuildMemberAvatarURLSimple: () => null,
};

export function registerDiscord() {
	opened.length = 0;
	hidden.length = 0;
	metro.register(ContextMenus);
	metro.register(ActionSheets);
	metro.register(IconUtils);
	metro.register({ colors: { TEXT_DEFAULT: '#fff' }, internal: {} });
	flux.seed({
		Channel: { getChannel: () => undefined },
		GuildMember: { getMember: () => null },
		UserProfile: { getUserProfile: () => null, getGuildMemberProfile: () => null },
		User: { getUser: (id: string) => ({ id, avatar: 'abc', banner: 'def' }) },
		Guild: { getGuild: () => undefined },
	});
}
