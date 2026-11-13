import { render, startPlugin } from '@unbound-app/api/testing';
import { Discord } from '@unbound-app/api/metro/components';
import { beforeEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import SettingsPanel from '~/settings';

beforeEach(async () => {
	Object.assign(Discord, {
		useNavigation: () => ({ push: () => undefined, goBack: () => undefined }),
	});
	await startPlugin();
});

describe('Keyword Notify settings', () => {
	test('lists the keywords in order and the ignore lists as pickers', () => {
		settings.keywords = ['unbound', 'loader'];
		settings.ignoreChannels = '1, 2';

		const view = render(<SettingsPanel />, { stores: { User: {}, Channel: {}, Guild: {} } });
		const labels = view
			.findAll((node) => typeof node.props.label === 'string')
			.map((node) => node.props.label);

		expect(view.find('ListRow').props.value).toEqual(['unbound', 'loader']);
		expect(labels).toEqual(
			expect.arrayContaining(['Ignored users', 'Ignored channels', 'Ignored servers']),
		);
	});
});
