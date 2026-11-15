import { describe, expect, test } from 'bun:test';

import { shownMarkers } from '~/lib/debug-card/markers';

describe('shownMarkers', () => {
	test('drops the markers every install reports', () => {
		expect(
			shownMarkers([
				'Developer Mode on',
				'SELinux enforcing',
				'boot green',
				'WebView com.google.android.webview 131',
			]),
		).toEqual([]);
	});

	test('keeps the unusual ones', () => {
		expect(
			shownMarkers([
				'Lockdown Mode',
				'SELinux permissive',
				'boot orange',
				'WebView com.google.android.webview 96',
				'WebView org.bromite.webview 131',
			]),
		).toEqual([
			'Lockdown Mode',
			'SELinux permissive',
			'boot orange',
			'WebView com.google.android.webview 96',
			'WebView org.bromite.webview 131',
		]);
	});
});
