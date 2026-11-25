import { expect, mock, test } from 'bun:test';

function Group() {
	return null;
}

function Row() {
	return null;
}

const ActionSheetRow = Object.assign(Row, { Group, Icon: () => null });

void mock.module('@unbound-app/api', () => ({ assets: { getIdByName: () => 1 } }));
void mock.module('@unbound-plugins/shared/action-sheets/action-sheet-row', () => ({
	getActionSheetRow: () => ActionSheetRow,
}));

const { insertSheetRows, UNBOUND_SECTION_KEY } = await import('~/action-sheets/sheet-rows');

type Node = {
	key?: unknown;
	type?: unknown;
	props: { children?: unknown; title?: unknown; hasIcons?: unknown };
};

function row(label: string) {
	return { key: label, type: {}, props: { label, onPress: () => undefined } };
}

function sheet(): Node {
	const discord = { type: {}, props: { hasIcons: true, children: [row('Mark as Read')] } };

	return { type: 'View', props: { children: [discord, { type: 'View', props: {} }] } };
}

const spec = (key: string) => ({ key, label: key, icon: 'Icon', onPress: () => undefined });

function children(node: Node): Node[] {
	return node.props.children as Node[];
}

test("adds an untitled shared section after Discord's first row group, leaving Discord's rows alone", () => {
	const result = sheet();

	insertSheetRows(result, [spec('view-permissions')]);

	const [discord, section] = children(result);

	expect(children(discord!).map((child) => child.key)).toEqual(['Mark as Read']);
	expect(section?.key).toBe(UNBOUND_SECTION_KEY);
	expect(section?.type).toBe(Group);
	expect(section?.props.title).toBeUndefined();
	expect(children(section!).map((child) => child.key)).toEqual(['view-permissions']);
});

test("a second plugin's rows join the same section, and a re-run adds nothing twice", () => {
	const result = sheet();

	insertSheetRows(result, [spec('view-permissions')]);
	insertSheetRows(result, [spec('hide-server'), spec('view-permissions')]);

	const sections = children(result).filter((child) => child.key === UNBOUND_SECTION_KEY);

	expect(sections).toHaveLength(1);
	expect(children(sections[0]!).map((child) => child.key)).toEqual([
		'view-permissions',
		'hide-server',
	]);
});

test('a group that is the only child of its parent gets the section beside it', () => {
	const group = { type: {}, props: { hasIcons: true, children: [row('Mark as Read')] } };
	const result: Node = { type: 'View', props: { children: group } };

	insertSheetRows(result, [spec('view-permissions')]);

	expect(children(result).map((child) => child.key)).toEqual([undefined, UNBOUND_SECTION_KEY]);
});

test('a group rendered as the root becomes a fragment of itself and the section', () => {
	const result: Node = { type: {}, props: { hasIcons: true, children: [row('Mark as Read')] } };

	insertSheetRows(result, [spec('view-permissions')]);
	insertSheetRows(result, [spec('hide-server')]);

	const [group, section] = children(result);

	expect(children(group!).map((child) => child.key)).toEqual(['Mark as Read']);
	expect(section?.key).toBe(UNBOUND_SECTION_KEY);
	expect(children(section!).map((child) => child.key)).toEqual([
		'view-permissions',
		'hide-server',
	]);
});

test('a sheet without a row group is left unchanged', () => {
	const result: Node = { type: 'View', props: { children: [{ type: 'Text', props: {} }] } };

	insertSheetRows(result, [spec('view-permissions')]);

	expect(children(result)).toHaveLength(1);
});
