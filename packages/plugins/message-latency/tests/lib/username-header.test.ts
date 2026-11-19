import type { NativeViewSnapshotNode } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import { findUsernameHeader } from '~/lib/username-header';

type Spec = { className: string; text?: string; width: number; height: number; parent: number };

function snapshot(specs: Spec[]): NativeViewSnapshotNode[] {
	return specs.map(
		(spec, index) =>
			({
				...spec,
				view: `view-${index}`,
				visible: true,
				frame: { x: 0, y: 0, width: spec.width, height: spec.height },
			}) as unknown as NativeViewSnapshotNode,
	);
}

const ROW = { className: 'UIView', width: 291, height: 22, parent: -1 };

function headerWith(...labels: string[]): NativeViewSnapshotNode[] {
	return snapshot([
		ROW,
		...labels.map((text) => ({
			className: 'DCDLabel',
			text,
			width: 60,
			height: 18,
			parent: 0,
		})),
	]);
}

describe('username header', () => {
	test('picks the label showing the account name', () => {
		const nodes = headerWith('Dev', 'dylib.dev');

		expect(findUsernameHeader(nodes, 'dylib.dev')?.label).toBe(nodes[2]!.view);
	});

	test('picks a label that contains the account name, such as a display name with it', () => {
		const nodes = headerWith('adrián (@dylib.dev)', 'Owner');

		expect(findUsernameHeader(nodes, 'dylib.dev')?.label).toBe(nodes[1]!.view);
	});

	test('picks the first label of the row when tags follow a nickname', () => {
		const nodes = headerWith('adrián', '말랑볼살', 'Dev', 'Owner');

		expect(findUsernameHeader(nodes, 'dylib.dev')).toEqual({
			label: nodes[1]!.view,
			header: nodes[0]!.view,
		});
	});

	test('finds nothing without a header row', () => {
		expect(findUsernameHeader(snapshot([ROW]), 'dylib.dev')).toBeNull();
	});
});
