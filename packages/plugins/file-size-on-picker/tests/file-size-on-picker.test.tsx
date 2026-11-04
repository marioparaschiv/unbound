import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { memo, type ReactElement } from 'react';
import { View } from 'react-native';

const lookups = new Map<string, number>();

mock.module('~/file-sizes/platform', () => ({
	createFileSizes: () => ({ lookup: (uri: string) => lookups.get(uri), release: () => {} }),
}));

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

function badges() {
	return render(<picker.default />)
		.findAll('Text')
		.map((node) => node.text());
}

beforeEach(async () => {
	items = [];
	lookups.clear();
	metro.register({ Fonts: { PRIMARY_BOLD: 'ggsans-Bold' }, Endpoints: {} });
	metro.register(picker, PICKER_PATH);
	await startPlugin();
});

describe('the media picker', () => {
	test('labels a thumbnail with the size Discord reports', () => {
		items = [image('a', 2048), image('b', 1536)];

		expect(badges()).toEqual(['2 KB', '1.5 KB']);
	});

	test('labels a thumbnail Discord reports no size for from the looked-up size', () => {
		lookups.set('content://media/1', 3 * 1024 ** 2);
		items = [image('content://media/1')];

		expect(badges()).toEqual(['3 MB']);
	});

	test('labels an empty file in bytes', () => {
		items = [image('a', 0)];

		expect(badges()).toEqual(['0 Bytes']);
	});

	test('shows no badge when no size is known', () => {
		items = [image('a')];

		expect(badges()).toEqual([]);
	});
});
