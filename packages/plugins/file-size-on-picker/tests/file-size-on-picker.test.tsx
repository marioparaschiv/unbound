import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { metro, native, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { memo, type ReactElement } from 'react';
import { View } from 'react-native';

import { selfTest } from '~/index';

const sizes = new Map<string, number>();

// A method receives the object a test made, whose fields are the ones it was created with.
function uriOf(made: unknown) {
	return (made as { fields: Map<string, string> }).fields.get('uri') ?? '';
}

// Android's content resolver as the plugin reaches it: a URI is looked up by its descriptor's size.
function registerContentResolver() {
	const { java } = native;

	java.registerClass('android.net.Uri', {
		staticMethods: { parse: (_self, uri) => java.create('android.net.Uri', { uri }) },
	});
	java.registerClass('android.os.ParcelFileDescriptor', {
		methods: {
			getStatSize: (self) => sizes.get(uriOf(self)) ?? -1,
			close: () => null,
		},
	});
	java.registerClass('android.content.ContentResolver', {
		methods: {
			openFileDescriptor: (_self, uri) =>
				java.create('android.os.ParcelFileDescriptor', {
					uri: uriOf(uri),
				}),
		},
	});
	java.registerClass('android.content.Context', {
		methods: { getContentResolver: () => java.create('android.content.ContentResolver') },
	});
	java.registerClass('android.app.Activity', {
		methods: { getApplicationContext: () => java.create('android.content.Context') },
	});
	java.registerClass('app.unbound.android.ActivityTracker', {
		methods: { currentActivity: () => java.create('android.app.Activity') },
		staticFields: { INSTANCE: java.create('app.unbound.android.ActivityTracker') },
	});
}

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
	await startPlugin();

	return render(<picker.default />)
		.findAll('Text')
		.map((node) => node.text());
}

beforeEach(async () => {
	items = [];
	sizes.clear();
	resetHealth();
	// Android is the platform whose picker needs a lookup.
	native.setPlatform('android');
	registerContentResolver();
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

describe('on iOS', () => {
	test('leaves the badge to the size Discord reports and never looks one up', async () => {
		native.setPlatform('ios');
		sizes.set('content://media/1', 3 * 1024 ** 2);
		items = [image('a', 2048), image('content://media/1')];

		expect(await badges()).toEqual(['2 KB']);
		expect(native.calls).toEqual([]);
	});
});

describe('the self test', () => {
	test('reports the badges applied once the plugin starts', async () => {
		await startPlugin();

		expect(selfTest().ok).toBe(true);
	});
});
