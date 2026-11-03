import type { ComponentType, Ref } from 'react';

export type WebViewNavigation = {
	url: string;
	isTopFrame?: boolean;
};

export type WebViewHandle = {
	injectJavaScript: (script: string) => void;
};

export type WebViewProps = {
	ref?: Ref<WebViewHandle>;
	source: { html: string; baseUrl: string };
	style?: unknown;
	originWhitelist?: string[];
	javaScriptEnabled?: boolean;
	domStorageEnabled?: boolean;
	allowsInlineMediaPlayback?: boolean;
	allowsFullscreenVideo?: boolean;
	allowsPictureInPictureMediaPlayback?: boolean;
	setSupportMultipleWindows?: boolean;
	onShouldStartLoadWithRequest?: (request: WebViewNavigation) => boolean;
};

type WebViewExports = {
	WebView?: unknown;
	default?: { WebView?: unknown };
};

function isComponent(value: unknown): value is ComponentType<WebViewProps> {
	if (typeof value === 'function') return true;

	return Boolean(value && typeof value === 'object' && '$$typeof' in value);
}

/**
 * @description Picks `react-native-webview`'s `WebView` component from the module Discord ships it in.
 * @param exports The module's exports, or nothing when it was not found.
 * @returns The component, or `undefined` when the module exports none.
 */
export function pickWebView(exports: unknown): ComponentType<WebViewProps> | undefined {
	if (!exports || typeof exports !== 'object') return;

	const module = exports as WebViewExports;

	return [module.WebView, module.default?.WebView].find(isComponent);
}
