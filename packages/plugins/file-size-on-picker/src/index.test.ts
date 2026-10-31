import type {
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativePluginCapability,
	PluginContext,
} from '@unbound-app/api/native';
import { installAddonGlobals } from '@unbound-app/api/testing';
import { expect, mock, test } from 'bun:test';

type AndroidHandler = (context: PluginContext) => object;

type FakeContext = {
	capabilities: readonly NativePluginCapability[];
	native: {
		capabilities: readonly NativePluginCapability[];
		java: Pick<NativeJavaBridge, 'getField' | 'invoke' | 'release'>;
	};
};

const released: string[] = [];

function handle(value: string): NativeJavaValue {
	return { type: 'handle', value };
}

const HANDLES: Record<string, NativeJavaValue> = {
	currentActivity: handle('activity'),
	getApplicationContext: handle('application'),
	getContentResolver: handle('resolver'),
	parse: handle('uri'),
	openFileDescriptor: { type: 'null' },
};

const java = {
	getClass: (name: string) => handle(`class ${name}`),
	getField: () => handle('tracker'),
	invoke: (_target: NativeJavaReference, name: string) => HANDLES[name] ?? { type: 'null' },
	release(reference: NativeJavaReference) {
		if ('value' in reference) released.push(reference.value);
	},
};

const bridge: FakeContext['native']['java'] = java;
const context: FakeContext = { capabilities: [], native: { capabilities: [], java: bridge } };

const scope = installAddonGlobals({
	manifest: { id: 'astral.file-size-on-picker' },
	unbound: {
		native: {
			definePlatform: (handlers: Record<string, AndroidHandler>) => handlers.android,
		},
	},
});

const row = {
	props: {
		children: [
			{ key: 'a', props: { item: { node: { image: { uri: 'content://media/1' } } } } },
		],
	},
};
const MediaKeyboardItem = { default: { type: () => row } };

scope.metro.register(
	MediaKeyboardItem,
	'modules/media_keyboard/native/components/MediaKeyboardItem.tsx',
);

mock.module('@unbound-app/api', () => scope.unbound);

mock.module('react-native', () => ({ Text: 'Text', View: 'View' }));

const { default: plugin } = await import('~/index');

test('stop releases the content resolver handles the Android lookup acquired', async () => {
	plugin.start(context as PluginContext);
	await Promise.resolve();
	MediaKeyboardItem.default.type();

	expect(released).toEqual(['uri']);

	plugin.stop();

	expect(released).toEqual(['uri', 'resolver', 'application']);
});
