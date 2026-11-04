import { describe, expect, test } from 'bun:test';

import { pickWebView } from '~/webview';

function WebView() {
	return null;
}

describe('pickWebView', () => {
	test('reads the named export', () => {
		expect(pickWebView({ WebView, default: WebView })).toBe(WebView);
	});

	test('reads the export of a default-only module', () => {
		expect(pickWebView({ default: { WebView } })).toBe(WebView);
	});

	test('accepts a forwardRef or memo component', () => {
		const wrapped = { $$typeof: Symbol.for('react.forward_ref'), render: WebView };

		expect(pickWebView({ WebView: wrapped })).toBe(wrapped as never);
	});

	test('ignores modules without a component', () => {
		expect(pickWebView(undefined)).toBeUndefined();
		expect(pickWebView(null)).toBeUndefined();
		expect(pickWebView({})).toBeUndefined();
		expect(pickWebView({ WebView: 'WebView' })).toBeUndefined();
		expect(pickWebView({ WebView: {} })).toBeUndefined();
	});
});
