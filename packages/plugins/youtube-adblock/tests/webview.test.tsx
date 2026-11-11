import { logs, metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';

import { INJECTED_FLAG } from '~/lib/adblock-script';

type WebViewProps = { source?: { uri?: string }; injectedJavaScript?: string };

const WebView = forwardRef<unknown, WebViewProps>((props, _ref) => (
	<View {...(props as ViewProps)} />
));

function renderWebView(props: WebViewProps) {
	return render(<WebView {...props} />).find('View').props as WebViewProps;
}

beforeEach(async () => {
	metro.register({ WebView });
	await startPlugin();
});

describe('a WebView', () => {
	test('loads the ad blocker for a YouTube page', () => {
		const props = renderWebView({
			source: { uri: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
		});

		expect(props.injectedJavaScript).toContain(INJECTED_FLAG);
	});

	test('loads the ad blocker for a Watch Together activity', () => {
		const props = renderWebView({
			source: { uri: 'https://880218394199220334.discordsays.com/' },
		});

		expect(props.injectedJavaScript).toContain(INJECTED_FLAG);
	});

	test('keeps the page script it already had', () => {
		const props = renderWebView({
			source: { uri: 'https://www.youtube.com/embed/x' },
			injectedJavaScript: 'window.mine = 1;',
		});

		expect(props.injectedJavaScript).toContain('window.mine = 1;');
		expect(props.injectedJavaScript).toContain(INJECTED_FLAG);
	});

	test('renders any other page unchanged', () => {
		const props = renderWebView({ source: { uri: 'https://example.com/' } });

		expect(props.injectedJavaScript).toBeUndefined();
	});
});

describe('the self test', () => {
	test('passes once the WebView is patched, with no warning', () => {
		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});
});
