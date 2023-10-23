import { Clipboard, Constants, ReactNative as RN, StyleSheet, Theme, i18n } from '@metro/common';
import type Plugins from '@managers/plugins';
import type Themes from '@managers/themes';
import { Redesign } from '@metro/components';
import { showAlert } from '@api/dialogs';
import { Icons } from '@api/assets';

interface InstallModalProps {
	manager: typeof Plugins | typeof Themes;
}

type ShowInstallModalProps = InstallModalProps & {
	ref: ReturnType<typeof React.useRef<InstanceType<typeof InstallInput>>>
}

class InstallInput extends React.PureComponent<InstallModalProps> {
	state = { url: '', loadingPaste: false, loadingInstall: false, message: null };

	render() {
		return <>
			{this.renderInput()}
			{this.renderSubmit()}
		</>
	}

	renderInput() {
		const { manager } = this.props;
		const { message } = this.state;

		return <RN.View style={{ display: 'flex', flexDirection: 'row', marginRight: 50 }}>
			<Redesign.TextInput
				isRound
				isClearable
				size={'md'}
				onChange={url => this.setState({ url })}
				onClear={() => this.setState({ error: false, message: null })}
				value={this.state.url}
				placeholder={`https://${manager.type}.com/manifest.json`}
				placeholderTextColor={Theme.unsafe_rawColors.PRIMARY_400}
				status={message ? 'error' : 'default'}
				errorMessage={message || undefined}
			/>

			<Redesign.IconButton
				icon={Icons['ClipboardListIcon']}
				style={{ marginLeft: 8 }}
				variant={'secondary-input'}
				size={'md'}
				loading={this.state.loadingPaste}
				onPress={() => {
					this.setState({ loadingPaste: true });

					Clipboard.getString().then(url => {
						this.setState({ url, loadingPaste: false });
					})
				}}
			/>
		</RN.View>
	}

	renderSubmit() {
		const { manager } = this.props;
		const { url } = this.state;

		return <Redesign.Button
			text={i18n.Messages.UNBOUND_INSTALL}
			style={{ marginTop: 18 }}
			loading={this.state.loadingInstall}
			onPress={() => {
				if (url) {
					this.setState({ loadingInstall: true });

					(manager).install(url, (state) => this.setState(state))
						.then(() => this.setState({ loadingInstall: false }));
				}
			}}
		/>
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
			color: Theme.colors.TEXT_NORMAL,
			fontFamily: Constants.Fonts.DISPLAY_NORMAL
		}
	});
}

export function showInstallAlert({ manager, ref }: ShowInstallModalProps) {
	// This uses a custom button so to prevent closing the dialog after failure
	// This is also to use a custom loading state for the async install method
	showAlert({
		title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: manager.type }),
		content: i18n.Messages.UNBOUND_ADDON_VALID_MANIFEST.format({ type: manager.type }),
		component: (
			<InstallInput
				manager={manager}
				ref={ref}
			/>
		),
		componentMargin: false
	});
}

export default { InstallInput };