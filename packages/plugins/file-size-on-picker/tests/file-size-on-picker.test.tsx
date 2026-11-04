import { metro, native, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { memo, type ReactElement } from 'react';
import { View } from 'react-native';

import type { NativeJavaBridge } from '@unbound-app/api/native';

type Handle = { type: 'handle'; value: string };

// Android's content resolver as the Java bridge reaches it: a URI is looked up by its descriptor's size.
const sizes = new Map<string, number>();

function handle(value: string): Handle {
	return { type: 'handle', value };
}

// UNKNOWN: the plugin calls only these members of the bridge, so the test gives only these.
const java = {
	getClass: (name: string) => handle(`class:${name}`),
	getField: () => handle('tracker'),
	release: () => {},
	invoke(target: Handle, name: string, args: { value?: unknown }[]) {
		if (name === 'parse') return handle(`uri:${args[0]?.value}`);
		if (name === 'openFileDescriptor') return handle(`file:${String(args[0]?.value).slice(4)}`);
		if (name === 'getStatSize')
			return { type: 'long', value: sizes.get(target.value.slice(5)) ?? -1 };
		return handle(name);
	},
};

const PICKER_PATH = 'modules/media_keyboard/native/components/MediaKeyboardItem.tsx';

let items: ReactElement[] = [];

function Item(_props: { item: object; size: number }) {
	return <View />;
}

function image(uri: string, fileSize?: number, size = 100) {
	return <Item key={uri} item={{ node: { image: { fileSize, uri } } }} size={size} />;
}

const picker = {
	default: memo(function Row() {
		return <View style={{ paddingHorizontal: 12 }}>{items}</View>;
	}),
	SEPARATOR_SIZE: 4,
};

async function badges() {
	await startPlugin({ native: { java: java as unknown as NativeJavaBridge } });

	return render(<picker.default />)
		.findAll('Text')
		.map((node) => node.text());
}

beforeEach(async () => {
	items = [];
	sizes.clear();
	// Android is the platform whose picker needs a lookup; `definePlatform` picks it once, when the plugin is first imported.
	native.setPlatform('android');
	metro.register({ Fonts: { PRIMARY_BOLD: 'ggsans-Bold' }, Endpoints: {} });
	metro.register(picker, PICKER_PATH);
});

describe('the media picker', () => {
	test('labels a thumbnail with the size Discord reports', async () => {
		items = [image('a', 2048), image('b', 1536)];

		expect(await badges()).toEqual(['2 KB', '1.5 KB']);
	});

	test('labels a thumbnail Discord reports no size for from the looked-up size', async () => {
		sizes.set('content://media/1', 3 * 1024 ** 2);
		items = [image('content://media/1')];

		expect(await badges()).toEqual(['3 MB']);
	});

	test('labels an empty file in bytes', async () => {
		items = [image('a', 0)];

		expect(await badges()).toEqual(['0 Bytes']);
	});

	test('shows no badge when no size is known', async () => {
		items = [image('a')];

		expect(await badges()).toEqual([]);
	});
});

describe('the self test', () => {
	test('reports the badges applied once the plugin starts', async () => {
		// Imported after `setPlatform`, since `definePlatform` picks the platform when the plugin is first imported.
		const { selfTest } = await import('~/index');

		await startPlugin({ native: { java: java as unknown as NativeJavaBridge } });

		expect(selfTest().ok).toBe(true);
	});
});
