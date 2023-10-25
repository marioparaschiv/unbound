import { Clipboard, Constants, ReactNative as RN, StyleSheet, Theme, i18n } from '@metro/common';
import { Redesign } from '@metro/components';
import { showAlert } from '@api/dialogs';
import { Icons } from '@api/assets';

import type { Manager } from '@typings/managers';
import { managers } from '@api';

interface InstallModalProps {
	type: Manager;
}

type ShowInstallModalProps = InstallModalProps & {
	ref: ReturnType<typeof React.useRef<InstanceType<typeof InstallInput>>>
}

class InstallInput extends React.PureComponent<InstallModalProps> {
	state = { url: '', loadingPaste: false, loadingInstall: false, message: null };

	get manager() {
		return managers[this.props.type];
	}

	render() {
		return <>
			{this.renderInput()}
			{this.renderSubmit()}
		</>
	}

	renderInput() {
		const { message } = this.state;

		return <RN.View style={{ display: 'flex', flexDirection: 'row', marginRight: 50 }}>
			<Redesign.TextInput
				isRound
				isClearable
				size={'md'}
				onChange={url => this.setState({ url })}
				onClear={() => this.setState({ error: false, message: null })}
				value={this.state.url}
				placeholder={`https://${this.manager.type}.com/manifest.json`}
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
		const { url } = this.state;

		return <Redesign.Button
			text={i18n.Messages.UNBOUND_INSTALL}
			style={{ marginTop: 18 }}
			loading={this.state.loadingInstall}
			onPress={() => {
				if (url) {
					this.setState({ loadingInstall: true });

					(this.manager).install(url, (state) => this.setState(state))
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

export function showInstallAlert({ type, ref }: ShowInstallModalProps) {
	const manager = managers[type];

	// This uses a custom button to prevent closing the dialog after failure
	// This is also to use a custom loading state for the async install method
	showAlert({
		title: i18n.Messages.UNBOUND_INSTALL_TITLE.format({ type: manager.type }),
		content: i18n.Messages.UNBOUND_ADDON_VALID_MANIFEST.format({ type: manager.type }),
		component: (
			<InstallInput
				type={type}
				ref={ref}
			/>
		),
		componentMargin: false
	});
}

export default { InstallInput };