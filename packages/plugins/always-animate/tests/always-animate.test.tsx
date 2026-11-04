import { logs, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';
import { memo, type ReactNode } from 'react';
import { Text } from 'react-native';

type AnimatedProps = { animate?: boolean; loop?: boolean };

const PATHS = {
	avatar: 'design/void/Avatar/native/Avatar.tsx',
	cutoutableAvatarImage: 'design/void/CutoutableAvatarImage/native/CutoutableAvatarImage.tsx',
	groupDMAvatar: 'modules/group_dm/native/GroupDMAvatar.tsx',
	decoration: 'modules/collectibles/native/components/CutoutableAvatarDecoration.tsx',
	nameplate: 'modules/collectibles/nameplates/native/Nameplate.tsx',
	profileEffect: 'modules/collectibles/profile_effects/native/ProfileEffectLayer.ios.tsx',
	guildIcon: 'modules/guild/native/GuildIcon.tsx',
	activityEmoji: 'modules/activity_status/native/ActivityEmoji.tsx',
};

type Components = Record<keyof typeof PATHS, ReturnType<typeof memo>>;

const components = {} as Components;
const modules = {} as Record<keyof typeof PATHS, { default: unknown }>;

const avatarUtils = {
	getUserAvatarURL: (_user: object, animated: boolean) =>
		animated ? 'avatar.gif' : 'avatar.png',
	getAvatarDecorationURL: (options: { canAnimate?: boolean }) =>
		options.canAnimate ? 'decoration-animated' : 'decoration-static',
	getGuildIconURL: (options: { canAnimate?: boolean }) =>
		options.canAnimate ? 'icon.gif' : 'icon.png',
};

function createComponent() {
	return memo(({ animate, loop }: AnimatedProps) => (
		<Text>{`animate:${Boolean(animate)} loop:${Boolean(loop)}`}</Text>
	));
}

beforeEach(() => {
	resetHealth();

	for (const name of Object.keys(PATHS) as (keyof typeof PATHS)[]) {
		components[name] = createComponent();
		modules[name] = { default: components[name] };
		metro.register(modules[name], PATHS[name]);
	}

	metro.register(avatarUtils, 'utils/AvatarUtils.tsx');
});

const rowData = { generateMessageRowData: (_data: object, options: object) => options };
const userSettings = {
	AnimateEmoji: { getSetting: () => false, useSetting: () => false },
	AnimateStickers: { getSetting: () => 1, useSetting: () => 1 },
	GifAutoPlay: { getSetting: () => false, useSetting: () => false },
};

const stickerUtils = { shouldAnimateSticker: () => false };

beforeEach(() => {
	metro.register(stickerUtils, 'modules/stickers/StickersUtils.tsx');
	metro.register(rowData);
	metro.register(userSettings, 'modules/user_settings/UserSettings.tsx');
});

function rendered(component: ReturnType<typeof memo>) {
	const Component = component as (props: AnimatedProps) => ReactNode;

	return render(<Component />).text();
}

describe('avatars', () => {
	test('builds animated avatar URLs', async () => {
		await startPlugin();
		expect(avatarUtils.getUserAvatarURL({ id: '1' }, false)).toBe('avatar.gif');
	});

	test('animates the avatar components', async () => {
		await startPlugin();

		expect(rendered(components.avatar)).toBe('animate:true loop:false');
	});

	test('goes back to still avatars when switched off, and animates again when switched on', async () => {
		await startPlugin();
		settings.avatars = false;
		expect(avatarUtils.getUserAvatarURL({ id: '1' }, false)).toBe('avatar.png');

		settings.avatars = true;
		expect(avatarUtils.getUserAvatarURL({ id: '1' }, false)).toBe('avatar.gif');
	});
});

describe('decorations', () => {
	test('builds animated decoration URLs', async () => {
		await startPlugin();
		expect(avatarUtils.getAvatarDecorationURL({ canAnimate: false })).toBe(
			'decoration-animated',
		);
	});

	test('animates the decoration component', async () => {
		await startPlugin();

		expect(rendered(components.decoration)).toBe('animate:true loop:false');
	});
});

describe('nameplates', () => {
	test('animate and loop', async () => {
		await startPlugin();

		expect(rendered(components.nameplate)).toBe('animate:true loop:true');
	});
});

describe('profile effects', () => {
	test('animate the effect layer', async () => {
		await startPlugin();

		expect(rendered(components.profileEffect)).toBe('animate:true loop:false');
	});
});

describe('servers', () => {
	test('builds animated icon URLs', async () => {
		await startPlugin();
		expect(avatarUtils.getGuildIconURL({ canAnimate: false })).toBe('icon.gif');
	});

	test('animates the guild icon component', async () => {
		await startPlugin();

		expect(rendered(components.guildIcon)).toBe('animate:true loop:false');
	});
});

describe('expressions', () => {
	test('animate emojis, GIFs and stickers in every message row', async () => {
		await startPlugin();

		expect(rowData.generateMessageRowData({ message: { id: '42' } }, {})).toEqual({
			animateEmoji: true,
			gifAutoPlay: true,
			animatingStickerMessageId: '42',
		});
	});

	test('make Discord read its own animation settings as on', async () => {
		await startPlugin();
		expect(userSettings.AnimateEmoji.getSetting()).toBe(true);
		expect(userSettings.GifAutoPlay.getSetting()).toBe(true);
		expect(userSettings.AnimateStickers.getSetting()).toBe(0);
	});

	test('animate stickers and custom status emojis', async () => {
		await startPlugin();

		expect(stickerUtils.shouldAnimateSticker()).toBe(true);
		expect(rendered(components.activityEmoji)).toBe('animate:true loop:false');
	});
});

describe('health', () => {
	test('the self test passes once started and fails once stopped', async () => {
		await startPlugin();

		expect(selfTest()).toEqual({ ok: true, detail: '8 features applied' });

		await stopPlugin();

		expect(selfTest().ok).toBe(false);
	});

	test('a part that cannot start leaves the others animating', async () => {
		modules.nameplate.default = 'not a component';

		await startPlugin();

		expect(rendered(components.decoration)).toBe('animate:true loop:false');
		expect(avatarUtils.getGuildIconURL({ canAnimate: false })).toBe('icon.gif');
		expect(selfTest()).toMatchObject({ ok: false });
		expect(logs.entries.some((entry) => entry.level === 'error')).toBe(true);
	});
});
