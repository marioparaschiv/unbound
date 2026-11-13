import { describe, expect, test } from 'bun:test';
import { Children, isValidElement, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { withoutIconButtons } from '~/lib/icon-buttons';

function PhoneCallIcon() {
	return null;
}

function VideoIcon() {
	return null;
}

function MagnifyingGlassIcon() {
	return null;
}

function Button(_props: { text: string; icon: ReactNode }) {
	return null;
}

const header = (
	<View>
		<View key='call'>
			<PhoneCallIcon />
		</View>
		<View key='video'>
			<VideoIcon />
		</View>
		<View key='search'>
			<MagnifyingGlassIcon />
		</View>
	</View>
);

const keys = (node: ReactNode) =>
	Children.toArray(
		isValidElement<{ children?: ReactNode }>(node) ? node.props.children : null,
	).map((child) => (isValidElement(child) ? String(child.key).replace(/^\.\$/, '') : ''));

describe('icon buttons', () => {
	test('removes the header buttons that draw the hidden icons', () => {
		expect(keys(withoutIconButtons(header, new Set(['PhoneCallIcon'])))).toEqual([
			'video',
			'search',
		]);
		expect(keys(withoutIconButtons(header, new Set(['PhoneCallIcon', 'VideoIcon'])))).toEqual([
			'search',
		]);
	});

	test('finds a button by its icon prop through a wrapping view', () => {
		const profile = (
			<View>
				<View key='message'>
					<Button text='Message' icon={<Text />} />
				</View>
				<View key='call'>
					<Button text='Call' icon={<PhoneCallIcon />} />
				</View>
			</View>
		);

		expect(keys(withoutIconButtons(profile, new Set(['PhoneCallIcon'])))).toEqual(['message']);
	});

	test('leaves a row alone when nothing matches', () => {
		expect(withoutIconButtons(header, new Set(['GiftIcon']))).toBeUndefined();
		expect(withoutIconButtons(header, new Set())).toBeUndefined();
	});
});
