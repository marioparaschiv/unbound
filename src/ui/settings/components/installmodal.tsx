import { ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import type Plugins from '@managers/plugins';
import type Themes from '@managers/themes';

interface InstallModalProps {
	manager: typeof Plugins | typeof Themes;
}

class InstallModal extends React.PureComponent<InstallModalProps> {
	state = { url: '' };

	render() {
		return <>
			<RN.TextInput
				style={this.styles.input}
				onChangeText={url => this.setState({ url })}
				value={this.state.url}
				placeholder='https://example.com/'
				placeholderTextColor={Theme.unsafe_rawColors.PRIMARY_400}
				autoFocus
			/>
		</>;
	}

	getInput() {
		return this.state.url;
	}

	styles = StyleSheet.createThemedStyleSheet({
		input: {
			height: 40,
			borderBottomWidth: 2,
			marginTop: 10,
			borderBottomColor: Theme.colors.CONTROL_BRAND_FOREGROUND_NEW ?? Theme.colors.CONTROL_BRAND_FOREGROUND,
			color: Theme.colors.TEXT_NORMAL
		}
	});
}

export default InstallModal;