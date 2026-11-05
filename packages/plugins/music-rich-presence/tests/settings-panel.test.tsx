import { render } from '@unbound-app/api/testing';
import { SettingsPanel, type Settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

function incompleteNotices(settings: Partial<Settings>) {
	return render(<SettingsPanel />, { settings }).findAll('NoticeRow');
}

describe('the Instance Incomplete notice', () => {
	test('warns when a self-hosted instance has no URL', () => {
		const [notice, ...others] = incompleteNotices({
			scrobblerBackend: 'listenbrainz-compatible',
			instanceBaseURL: 'https://lb.example.org',
			instanceAPIBaseUrl: '',
		});

		expect(others).toEqual([]);
		expect(notice.props).toMatchObject({ title: 'Instance Incomplete', tone: 'warning' });
	});

	test('stays hidden once both URLs are set', () => {
		expect(
			incompleteNotices({
				scrobblerBackend: 'listenbrainz-compatible',
				instanceBaseURL: 'https://lb.example.org',
				instanceAPIBaseUrl: 'https://api.lb.example.org',
			}),
		).toEqual([]);
	});

	test('stays hidden for the other scrobblers', () => {
		expect(incompleteNotices({ scrobblerBackend: 'lastfm' })).toEqual([]);
	});
});
