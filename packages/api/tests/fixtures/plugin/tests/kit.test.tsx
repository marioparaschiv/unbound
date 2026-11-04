import {
	commands as pluginCommands,
	flux as pluginFlux,
	fs as pluginFs,
	metro as pluginMetro,
	native as pluginNative,
	utils,
} from '@unbound-app/api';
import {
	commands,
	extendApi,
	flux,
	fs,
	metro,
	native,
	patches,
	pluginHolds,
	render,
	startPlugin,
	stopPlugin,
} from '@unbound-app/api/testing';
import { BottomSheets, Discord, Forms, HelpMessageTypes } from '@unbound-app/api/metro/components';
import { createElement, Component, type ReactNode } from 'react';
import { describe, expect, test } from 'bun:test';

import * as plugin from '~/index';

type CounterProps = { step: number; children?: ReactNode };

type CounterState = { count: number };

type StepProps = { step: number };

const user = { id: '1', username: 'wumpus' };

// A lookup made at import, before any test registers the module.
const lateModule = pluginMetro.findByProps('lateProp');

describe('stopPlugin', () => {
	test('disposes what the plugin scope recorded, as Unbound does on stop', async () => {
		const target = { run: () => 1 };
		let fired = false;

		metro.register({ sendMessage: (content: string) => content });
		await startPlugin();
		patcher.after(target, 'run', () => 2);
		pluginFlux.onAction('CHANNEL_SELECT', () => {});
		setTimeout(() => void (fired = true), 5);

		expect(target.run()).toBe(2);
		expect(pluginHolds()).toContain('timer');

		await stopPlugin();
		await Bun.sleep(15);

		expect(fired).toBe(false);
		expect(target.run()).toBe(1);
		expect(patches.applied).toEqual([]);
	});

	test('lets a test check that a feature undid itself without stopping', async () => {
		metro.register({ sendMessage: (content: string) => content });
		await startPlugin();

		expect(pluginHolds().sort()).toEqual([
			'command /star',
			'flux.onAction(MESSAGE_CREATE)',
			'patcher.before on sendMessage',
		]);

		plugin.stop();

		expect(pluginHolds()).toEqual([]);
		await stopPlugin();
	});
});

describe('resetSession', () => {
	test('registers a module a lazy handle made at import then finds', () => {
		metro.register({ lateProp: 1 });

		expect(lateModule?.lateProp).toBe(1);
	});

	test('forgets registered modules before the next test, and the handle finds the new ones', () => {
		expect(lateModule?.lateProp).toBeUndefined();
		expect(pluginMetro.getModulePresence(lateModule)).toBe('missing');

		metro.register({ lateProp: 2 });

		expect(lateModule?.lateProp).toBe(2);
	});
});

describe('flux stores', () => {
	test('show a patch made through getStore in later reads', () => {
		flux.seed({ User: { getCurrentUser: () => ({ ...user }) } });

		const unpatch = patcher.after(
			pluginFlux.getStore('User'),
			'getCurrentUser',
			({ result }) => {
				if (result) {
					result.username = 'patched';
				}
			},
		);

		expect(pluginFlux.getStore('User').getCurrentUser()?.username).toBe('patched');
		expect(pluginMetro.stores.Users.getCurrentUser()?.username).toBe('patched');

		unpatch();

		expect(pluginFlux.getStore('User').getCurrentUser()?.username).toBe('wumpus');
	});
});

describe('metro', () => {
	test('serves the API and store handles, ReactNative and the filters plugins call', () => {
		metro.register({ sendMessage: () => 'sent', receiveMessage: () => 'received' });
		flux.seed({ Guild: { getGuilds: () => ({}) } });
		metro.register({ type: function ChatInput() {} });
		metro.register({ tag: 'x', n: 1 });
		metro.register({ tag: 'x', n: 2 });

		const tagged = pluginMetro.filters.byProps('tag');

		expect(pluginMetro.api.Messages.sendMessage()).toBe('sent');
		expect(pluginMetro.stores.Guilds.getGuilds()).toEqual({});
		expect(pluginMetro.common.ReactNative.Platform.OS).toBe('ios');
		expect(pluginMetro.find(pluginMetro.filters.byTypeName('ChatInput'))).toBeDefined();
		expect(pluginMetro.find(tagged, { all: true })).toHaveLength(2);
		expect(pluginMetro.find(tagged).n).toBe(1);
	});
});

describe('components', () => {
	test('import in tests, and render as nodes find reaches by name', () => {
		const useStyles = Discord.createStyles(() => ({ box: { padding: 4 } }));

		function Sheet() {
			return (
				<BottomSheets.ActionSheet>
					<Discord.Text numberOfLines={1}>Title</Discord.Text>
					<Forms.FormRow label='Row' />
					<BottomSheets.ActionSheetRow.Icon />
				</BottomSheets.ActionSheet>
			);
		}

		const view = render(<Sheet />);

		expect(useStyles()).toEqual({ box: { padding: 4 } });
		expect(view.find('Text').props.numberOfLines).toBe(1);
		expect(view.find('ActionSheet').text()).toBe('Title');
		expect(view.find('FormRow').props.label).toBe('Row');
		expect(view.findAll('ActionSheetRow.Icon')).toHaveLength(1);
		expect(HelpMessageTypes.WARNING).toBe(0);
	});
});

describe('native', () => {
	test('selects by the platform a test sets, ios by default', () => {
		const handlers = { ios: 'iOS', android: 'Android' };

		expect(pluginNative.definePlatform(handlers)).toBe('iOS');

		native.setPlatform('android');

		expect(pluginNative.definePlatform(handlers)).toBe('Android');
		expect(pluginMetro.common.ReactNative.Platform.OS).toBe('android');
		expect(() => pluginNative.definePlatform({ ios: 1 })).toThrow(
			pluginNative.NativePluginUnsupportedPlatformError,
		);
	});

	test('puts the platform back to ios before the next test', () => {
		expect(pluginNative.definePlatform({ ios: 'iOS', android: 'Android' })).toBe('iOS');
	});

	test('finds the native modules a test registers', () => {
		native.registerModule('FileManager', { path: '/x' });

		expect(pluginNative.getNativeModule('Missing', 'FileManager')).toEqual({ path: '/x' });
		expect(pluginNative.getNativeModule('Missing')).toBeUndefined();
	});

	test('hands start a PluginContext with the native bridge a test gives it', async () => {
		metro.register({ sendMessage: (content: string) => content });

		await startPlugin({ capabilities: ['native.ffi.call'], native: { apiVersion: '9.9.9' } });

		const context = plugin.received.at(-1);

		expect(context).toMatchObject({
			id: 'fixture-plugin',
			platform: 'ios',
			capabilities: ['native.ffi.call'],
			native: { apiVersion: '9.9.9' },
		});
		expect(Object.keys(context?.native.ffi ?? {})).toEqual([]);
		await stopPlugin();
	});
});

describe('ui and utils', () => {
	test('draw settings rows as named nodes', async () => {
		const { Page, SwitchRow } = await import('@unbound-app/api/ui');
		const view = render(
			<Page>
				<SwitchRow label='Enabled' />
			</Page>,
		);

		expect(view.find('SwitchRow').props.label).toBe('Enabled');
	});

	test('search trees with the client implementations', () => {
		const tree = createElement(
			'View',
			null,
			createElement('Text', { id: 1 }),
			createElement('Text', { id: 2 }),
		);

		expect(utils.react.findComponent(tree, 'Text')?.props.id).toBe(1);
		expect(utils.react.filterComponents(tree, 'Text')).toHaveLength(2);
		expect(utils.react.findInTree(tree, (node) => node?.id === 2)?.id).toBe(2);
		expect(utils.findInTree({ a: { b: 3 } }, (node) => node === 3)).toBe(3);
		expect(utils.react.shallow({ a: 1 }, { a: 1 })).toBe(true);
		expect(utils.react.shallow({ a: 1 }, { a: 2 })).toBe(false);
	});
});

describe('fs', () => {
	test('keeps files in memory, and forgets them before the next test', async () => {
		await pluginFs.writeFile('notes/a.txt', 'hi');

		expect(await pluginFs.readFile('notes/a.txt')).toBe('hi');
		expect(await pluginFs.exists('notes/a.txt')).toBe(true);
		expect(fs.files.get(`${pluginFs.documentsPath}/notes/a.txt`)).toBe('hi');
		expect(await pluginFs.removeFile('notes')).toBe(true);
		expect(await pluginFs.exists('notes/a.txt')).toBe(false);

		await pluginFs.writeFile('kept.txt', 'x');
	});

	test('starts each test with no files', async () => {
		expect(fs.files.size).toBe(0);

		const error = await pluginFs.readFile('kept.txt').catch((reason: Error) => reason);

		expect(error).toBeInstanceOf(Error);
		expect(String(error)).toMatch(/does not exist/);
	});
});

describe('react-native', () => {
	test('serves the modules plugins read without a react-native install of their own', async () => {
		const { Animated, Dimensions, NativeEventEmitter, Share, processColor } =
			await import('react-native');
		const emitter = new NativeEventEmitter();
		const heard: number[] = [];
		const subscription = emitter.addListener('tick', (value: number) => heard.push(value));
		const opacity = new Animated.Value(0);
		let finished = false;
		let current = -1;

		emitter.emit('tick', 1);
		subscription.remove();
		emitter.emit('tick', 2);
		Animated.timing(opacity, { toValue: 1, duration: 10, useNativeDriver: true }).start(
			() => void (finished = true),
		);

		expect(heard).toEqual([1]);
		expect(processColor('#5865f2')).toBe(0xff5865f2);
		expect(processColor('rgba(0, 0, 0, 0.5)')).toBe(0x80000000);
		expect(finished).toBe(true);
		opacity.stopAnimation((value) => void (current = value));
		expect(current).toBe(1);
		expect(Dimensions.get('window').width).toBe(390);
		expect(await Share.share({ message: 'hi' })).toEqual({ action: 'sharedAction' });
	});
});

describe('render', () => {
	test('draws class components with state, props and lifecycle', () => {
		const log: string[] = [];

		class Counter extends Component<CounterProps, CounterState> {
			state = { count: 0 };

			componentDidMount() {
				log.push('mount');
			}

			componentDidUpdate(previous: StepProps) {
				log.push(`update ${previous.step}->${this.props.step}`);
			}

			componentWillUnmount() {
				log.push('unmount');
			}

			render() {
				return (
					<Discord.Text
						onPress={() => this.setState({ count: this.state.count + this.props.step })}
					>
						{this.state.count}
					</Discord.Text>
				);
			}
		}

		const view = render(<Counter step={2} />);

		view.act(() => view.find('Text').props.onPress?.(Object.create(null)));
		expect(view.text()).toBe('2');

		view.rerender(<Counter step={3} />);
		view.unmount();

		expect(log).toEqual(['mount', 'update 2->2', 'update 2->3', 'unmount']);
	});

	test('builds elements that are not frozen, as on device', () => {
		const element = <Discord.Text />;

		expect(Object.isFrozen(element)).toBe(false);
		expect(Reflect.set(element, 'type', 'Text')).toBe(true);
		expect(Object.isFrozen(createElement('View'))).toBe(false);
	});
});

describe('extendApi', () => {
	test('adds members to a fake namespace the plugin reads', () => {
		extendApi('metro', { custom: { value: 1 } });
		extendApi('metro.components', { Extra: 'extra' });

		expect(Reflect.get(pluginMetro, 'custom')).toEqual({ value: 1 });
		expect(() => extendApi('missing', {})).toThrow(/no such namespace/);
	});
});

describe('commands', () => {
	test('register through the plugin scope and clear on stop', async () => {
		metro.register({ sendMessage: (content: string) => content });
		await startPlugin();
		pluginCommands.register({
			extra: {
				description: 'STAR_DESCRIPTION',
				execute: () => ({ ephemeral: true, content: 'x' }),
			},
		});

		expect([...commands.registered.keys()].sort()).toEqual(['extra', 'star']);
		await stopPlugin();
		expect(commands.registered.size).toBe(0);
	});
});
