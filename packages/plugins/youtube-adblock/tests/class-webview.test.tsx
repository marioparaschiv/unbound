import { logs, metro, pluginHolds, render, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';
import { Component } from 'react';
import { View, type ViewProps } from 'react-native';

type WebViewProps = { source?: { uri?: string }; injectedJavaScript?: string };

class ClassWebView extends Component<WebViewProps> {
	render() {
		return <View {...(this.props as ViewProps)} />;
	}
}

describe('a WebView that is a class component', () => {
	test('is skipped and reported, and renders unchanged', async () => {
		metro.register({ WebView: ClassWebView });
		await startPlugin();

		const props = render(
			<ClassWebView source={{ uri: 'https://www.youtube.com/embed/x' }} />,
		).find('View').props as WebViewProps;

		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['WebView ad blocker skipped: WebView is a class component.'],
		});
		expect(pluginHolds()).toEqual([]);
		expect(props.injectedJavaScript).toBeUndefined();
	});
});
