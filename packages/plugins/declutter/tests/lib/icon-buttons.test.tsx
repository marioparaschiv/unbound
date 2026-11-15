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
	).map((child) => (isValidElement(child) ? String(child.key).replace(/^(\.\$)+/, '') : ''));

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

	test('finds the call button in the nested row of a profile beside Add Friend', () => {
		const profile = (
			<View>
				<View>
					<View key='friend'>
						<Text />
					</View>
					<View key='actions'>
						<Button key='message' text='Message' icon={<Text />} />
						<Button key='call' text='Call' icon={<PhoneCallIcon />} />
					</View>
				</View>
			</View>
		);
		const pruned = withoutIconButtons(profile, new Set(['PhoneCallIcon']));
		const [inner] = Children.toArray(
			isValidElement<{ children?: ReactNode }>(pruned) ? pruned.props.children : null,
		);
		const [, actions] = Children.toArray(
			isValidElement<{ children?: ReactNode }>(inner) ? inner.props.children : null,
		);

		expect(keys(inner)).toEqual(['friend', 'actions']);
		expect(keys(actions)).toEqual(['message']);
	});

	test('leaves a row alone when nothing matches', () => {
		expect(withoutIconButtons(header, new Set(['GiftIcon']))).toBeUndefined();
		expect(withoutIconButtons(header, new Set())).toBeUndefined();
	});
});
