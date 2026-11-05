import {
	commands,
	dialogs,
	fakeAssetId,
	flux,
	metro,
	patches,
	render,
	setLocale,
	startPlugin,
	stopPlugin,
	toasts,
} from '@unbound-app/api/testing';
import { flux as pluginFlux, dialogs as pluginDialogs } from '@unbound-app/api';
import { format, messages } from '@unbound-app/i18n';
import { describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import GreetingTitle from '~/components/greeting-title';
import StarCount from '~/components/star-count';

import starAsset from '../assets/star.svg?asset';
import icon from '../assets/icon.png';

const user = { id: '1', username: 'wumpus' };

describe('virtual modules', () => {
	test('serve the plugin manifest, its messages and settings, and stable image ids', () => {
		expect(addon.id).toBe('fixture-plugin');
		expect(messages.GREETING_TITLE).toBe('Hello!');
		expect(settings.greetOnStart).toBe(true);
		expect(settings.appearance.size).toBe(14);
		expect(icon).toBe(fakeAssetId('icon'));
		expect(starAsset).toBe(fakeAssetId('star', 'png'));
	});
});

describe('format', () => {
	test('formats plural, select and selectordinal with ICU rules', () => {
		expect(format('STARS', { count: 0 })).toBe('No stars');
		expect(format('STARS', { count: 1 })).toBe('1 star');
		expect(format('STARS', { count: 1200 })).toBe('1,200 stars');
		expect(format('ROLE', { role: 'admin' })).toBe('An admin');
		expect(format('ROLE', { role: 'guest' })).toBe('A member');
		expect(format('PLACE', { place: 2 })).toBe('2nd');
		expect(format('PLACE', { place: 13 })).toBe('13th');
		expect(format('QUOTED')).toBe("Use {braces} and it's fine.");
	});

	test('follows the locale, falling back to en-US for a missing key', () => {
		setLocale('de');

		expect(format('STARS', { count: 1200 })).toBe('1.200 Sterne');
		expect(messages.STARRED).toBe('{name} starred {user}.');
	});
});

describe('setLocale', () => {
	test('re-renders every component that reads messages', () => {
		const view = render(<GreetingTitle />);

		expect(view.text()).toBe('Hello!');

		setLocale('de');

		expect(view.text()).toBe('Hallo!');
	});

	test('starts each test in en-US', () => {
		expect(messages.GREETING_TITLE).toBe('Hello!');
	});
});

describe('settings', () => {
	test('saves a write to the memory Bucket', () => {
		settings.greetOnStart = false;
		settings.appearance.size = 20;

		expect(settings.greetOnStart).toBe(false);
		expect(() => (settings.appearance.size = 99)).toThrow(TypeError);
	});

	test('reset to their defaults before the next test', () => {
		expect(settings.greetOnStart).toBe(true);
		expect(settings.appearance.size).toBe(14);
	});
});

describe('render', () => {
	test('finds host nodes by name and by predicate, and reads their text', () => {
		const view = render(<GreetingTitle />);

		expect(view.find('Image').props.source).toBe(icon);
		expect(view.find('Svg(star)').find('SvgXml').props.width).toBe(16);
		expect(view.find((node) => node.name === 'Text').text()).toBe('Hello!');
		expect(view.findAll('View')).toHaveLength(1);
		expect(() => view.find('Switch')).toThrow(/No rendered node matches "Switch"/);
	});

	test('applies settings, locale and stores, and re-renders on state, settings and store changes', () => {
		const view = render(<StarCount />, {
			settings: { appearance: { size: 18 } },
			locale: 'de',
			stores: { User: { getCurrentUser: () => user } },
		});

		expect(view.text()).toBe('wumpus: Keine Sterne');
		expect(view.find('Text').props.style).toEqual({ fontSize: 18, color: '#5865f2' });

		view.act(() => view.find('Pressable').props.onPress?.(Object.create(null)));
		expect(view.text()).toBe('wumpus: 1 Stern');

		settings.appearance.size = 22;
		expect(view.find('Text').props.style).toEqual({ fontSize: 22, color: '#5865f2' });

		flux.seed({ User: { getCurrentUser: () => ({ id: '2', username: 'clyde' }) } });
		expect(view.text()).toBe('clyde: 1 Stern');
	});
});

describe('recorders', () => {
	test('record toasts, commands, patches and dialogs', async () => {
		const MessageActions = { sendMessage: (content: string) => content };

		metro.register(MessageActions);
		await startPlugin();

		expect(toasts.shown).toMatchObject([
			{ title: GreetingTitle, content: 'Fixture Plugin is running.' },
		]);
		expect(patches.applied).toMatchObject([{ kind: 'before', method: 'sendMessage' }]);
		expect(MessageActions.sendMessage('hi')).toBe('hi ⭐');
		expect([...commands.registered.keys()]).toEqual(['star']);
		expect(await commands.run('star', { user })).toEqual({
			ephemeral: true,
			content: '1 star',
		});
		expect(toasts.shown.at(-1)).toMatchObject({
			key: 'STARRED',
			title: 'Fixture Plugin starred wumpus.',
		});

		const answer = pluginDialogs.confirm('UNSTAR_TITLE', { confirm: 'UNSTAR' });

		expect(dialogs.opened[0]).toMatchObject({ key: 'UNSTAR_TITLE', title: 'Unstar?' });
		dialogs.opened[0]?.respond('Unstar');
		expect(await answer).toBe(true);

		await stopPlugin();
		expect(patches.applied).toEqual([]);
		expect(commands.registered.size).toBe(0);
	});

	test('skip the greeting when the setting is off', async () => {
		metro.register({ sendMessage: (content: string) => content });
		settings.greetOnStart = false;
		await startPlugin();

		expect(toasts.shown).toEqual([]);
		await stopPlugin();
	});
});

describe('stopPlugin', () => {
	test('fails on a Flux store listener added directly, which Unbound does not remove', async () => {
		flux.seed({ User: { getCurrentUser: () => user } });
		metro.register({ sendMessage: (content: string) => content });
		await startPlugin();
		pluginFlux.getStore('User').addChangeListener(() => {});

		const error = await stopPlugin().then(
			() => undefined,
			(reason: Error) => reason,
		);

		expect(error?.message).toBe(
			'Fixture Plugin left 1 thing(s) behind after stop():\n  - UserStore.addChangeListener',
		);
	});
});
