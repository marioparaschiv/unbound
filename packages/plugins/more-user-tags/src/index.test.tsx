import { afterEach, expect, mock, test } from 'bun:test';

let afterHandler: ((context: any) => any) | null = null;
let useOpTagStyle = true;
let memberColors: any = null;
const classLookups: string[] = [];

mock.module('@unbound-app/api', () => ({
	metro: {
		common: { ReactNative: { processColor: (color: string) => color } },
		findByName: () => ({ default: () => null }),
		findByProps: (...props: string[]) => {
			if (props.includes('Permissions'))
				return { Permissions: { ADMINISTRATOR: 2n, MANAGE_GUILD: 1n } };
			if (props.includes('computePermissions')) return { computePermissions: () => 1n };
			return undefined;
		},
		findStore: (name: string) => {
			if (name === 'Guild') return { getGuild: () => ({ id: 'guild' }) };
			if (name === 'Channel') return { getChannel: () => ({ guild_id: 'guild' }) };
			if (name === 'GuildMember') return { getMember: () => memberColors };
			return undefined;
		},
	},
	patcher: {
		after: (_holder: any, _prop: string, callback: (context: any) => any) => {
			afterHandler = callback;
			return () => {};
		},
	},
	storage: {
		getStore: () => ({
			get: (key: string, fallback: unknown) =>
				key === 'useOpTagStyle' ? useOpTagStyle : fallback,
		}),
	},
}));
mock.module('@shared/settings-ui', () => ({
	getSettingsColors: () => ({}),
	SettingsCard: () => null,
	SettingsRow: () => null,
	SettingsScrollView: () => null,
	SettingsSection: () => null,
	SettingsSwitchRow: () => null,
}));

const { default: plugin } = await import('@more-user-tags/index');

afterEach(async () => {
	await plugin.stop();
	afterHandler = null;
	useOpTagStyle = true;
	memberColors = null;
	classLookups.length = 0;
});

test('combines Discord OP and custom tags with the resolved role color', async () => {
	memberColors = {
		colorStrings: { primaryColor: '#123456', secondaryColor: '#789abc' },
		colorString: '#123456',
	};
	await plugin.start({
		native: {
			objc: {
				getClass: (name: string) => {
					classLookups.push(name);
					return null;
				},
			},
		},
	} as any);
	const nativeTag = {
		opTagText: 'OP',
		opTagBackgroundColor: 111,
		opTagTextColor: 222,
	};

	const patched = afterHandler?.({
		args: [
			{
				message: {
					author: { id: 'author', bot: false },
					channel_id: 'thread',
				},
			},
		],
		result: nativeTag,
	});

	expect(patched.opTagText).toBe('OP · Staff');
	expect(patched.opTagBackgroundColor).toBe('#123456');
	expect(patched.opTagTextColor).toBe('#ffffff');
	expect(patched.tagText).toBeNull();
	expect(patched.tagBackgroundColor).toBeNull();
	expect(patched.tagAccessibilityLabel).toBe('OP · Staff');
	expect(classLookups).not.toContain('CIColor');
});

test('keeps a combined OP and custom tag in the normal tag style when selected', async () => {
	useOpTagStyle = false;
	await plugin.start({
		native: {
			objc: {
				getClass: (name: string) => {
					classLookups.push(name);
					return null;
				},
			},
		},
	} as any);
	const nativeTag = {
		opTagText: 'OP',
		opTagBackgroundColor: 111,
		opTagTextColor: 222,
	};

	const patched = afterHandler?.({
		args: [
			{
				message: {
					author: { id: 'author', bot: false },
					channel_id: 'thread',
				},
			},
		],
		result: nativeTag,
	});

	expect(patched.opTagText).toBeNull();
	expect(patched.opTagBackgroundColor).toBeNull();
	expect(patched.opTagTextColor).toBeNull();
	expect(patched.tagText).toBe('OP · Staff');
	expect(patched.tagAccessibilityLabel).toBe('OP · Staff');
	expect(patched.tagBackgroundColor).toBe('#248046');
	expect(patched.tagTextColor).toBe('#ffffff');
});
