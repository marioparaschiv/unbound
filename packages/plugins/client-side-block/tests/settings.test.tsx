import { render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import SettingsPanel from '~/settings';

beforeEach(async () => {
	await startPlugin();
});

describe('Client Side Block settings', () => {
	test('picks hidden users from a list and stores their ids', () => {
		settings.users = '7, 8';

		const view = render(<SettingsPanel />, { stores: { User: { getUser: () => undefined } } });
		const list = view.find('EntityList');

		expect(list.props.value).toEqual(['7', '8']);

		view.act(() => list.props.onChange(['8', '9']));

		expect(settings.users).toBe('8, 9');
	});
});
