import { describe, expect, test } from 'bun:test';

import { headerLayout } from './header-layout';

const header = {
	row: { view: 'row', frame: { x: 0, y: 0, width: 300, height: 20 } },
	group: { view: 'group', frame: { x: 10, y: 0, width: 140, height: 20 } },
	username: { view: 'name', frame: { x: 0, y: 1, width: 70, height: 18 } },
	trailing: [{ view: 'tag', frame: { x: 76, y: 4, width: 30, height: 12 } }],
	timestamp: { view: 'time', frame: { x: 160, y: 2, width: 50, height: 16 } },
	icon: 'icon',
};

describe('headerLayout', () => {
	const layout = headerLayout(header);

	test('widens the name group by the icon and keeps the timestamp gap after it', () => {
		const [group, timestamp] = layout.row;

		expect(group).toMatchObject({ view: 'group', leading: ['row', 'leading', 10], width: 156 });
		expect(timestamp).toMatchObject({
			view: 'time',
			leading: ['group', 'trailing', 10],
			centerY: ['row', 0],
		});
	});

	test('puts the icon where the name was and the name and badges after it', () => {
		const [icon, name, tag] = layout.group;

		expect(icon).toMatchObject({ view: 'icon', leading: ['group', 'leading', 0], width: 16 });
		expect(name).toMatchObject({ view: 'name', leading: ['icon', 'trailing', 0] });
		expect(tag).toMatchObject({
			view: 'tag',
			leading: ['name', 'trailing', 6],
			centerY: ['group', 0],
		});
	});
});
