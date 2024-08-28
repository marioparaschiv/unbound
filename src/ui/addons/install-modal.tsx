import { PureComponent, type useRef } from 'react';
import { Theme, Clipboard } from '@metro/common';
import type { Manager } from '@typings/managers';
import { useSettingsStore } from '@api/storage';
import { Design } from '@metro/components';
import { showDialog } from '@api/dialogs';
import { capitalize } from '@utilities';
import { showToast } from '@api/toasts';
import * as managers from '@managers';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';
import { View } from 'react-native';
import { Links } from '@constants';

interface InstallModalProps {
	type: Manager;
	ref: ReturnType<typeof useRef<InstanceType<typeof InternalInstallInput>>>;
}

type InternalInstallModalProps = InstallModalProps & {
	settings: ReturnType<typeof useSettingsStore>;
};

export class InternalInstallInput extends PureComponent<InternalInstallModalProps> {
	controller = new AbortController();
	state = { url: '', loadingPaste: false, loadingInstall: false, message: null, error: null };

	get manager() {
		return managers[this.props.type];
	}

	render() {
		return <>
			{this.renderInput()}
			{this.renderButtons()}
		</>;
	}

	renderInput() {
		const { message, error } = this.state;
		const { settings } = this.props;

		return <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
			<View style={{ flex: 1, flexGrow: 1 }}>
				<Design.TextInput
					isRound
					isClearable
					size={'md'}
					onChange={url => this.setState({ url })}
					onClear={() => this.setState({ error: null, message: null })}
					value={this.state.url}
					placeholder={`https://${this.manager.type}.com/manifest.json`}
					placeholderTextColor={Theme.unsafe_rawColors.PRIMARY_400}
					errorMessage={error}
					description={message}
				/>
			</View>

			<Design.IconButton
				icon={Icons['ClipboardListIcon']}
				style={{ marginLeft: 8 }}
				variant={'tertiary'}
				size={'md'}
				loading={this.state.loadingPaste}
				onPress={() => {
					if (settings.get('onboarding.install', false)) {
						this.setState({ url: Links.OnboardingPlugin });
						return;
					}

					this.setState({ loadingPaste: true });

					Clipboard.getString().then(url => {
						this.setState({ url, loadingPaste: false });
					});
				}}
			/>
		</View>;
	}

	renderButtons() {
		const { url } = this.state;
		const { settings } = this.props;

		return <>
			<Design.Button
				text={Strings.UNBOUND_INSTALL}
				style={{ marginTop: 18 }}
				loading={this.state.loadingInstall}
				onPress={() => {
					if (url) {
						this.setState({ loadingInstall: true });

						(this.manager).install(url, (state) => this.setState(state), this.controller.signal)
							.then(() => {
								this.setState({ loadingInstall: false });

								if (settings.get('onboarding.install', false)) {
									settings.set('onboarding.install', false);
								}
							});
					}
				}}
			/>
			<Design.Button
				text={Strings.CANCEL}
				style={{ marginTop: 12 }}
				onPress={() => {
					Design.dismissAlerts();

					if (this.state.loadingInstall) {
						this.controller.abort();

						showToast({
							title: this.manager.name,
							content: Strings.UNBOUND_INSTALL_CANCELLED.format({ type: capitalize(this.manager.type) }),
							icon: 'CloseLargeIcon'
						});
					}
				}}
				variant={'secondary'}
			/>
		</>;
	}

	getInput() {
		return this.state.url;
	}
}

function InstallInput(props: InstallModalProps) {
	const settings = useSettingsStore('unbound');

	return <InternalInstallInput settings={settings} {...props} />;
}

export function showInstallAlert({ type, ref }: InstallModalProps) {
	const manager = managers[type];

	// This uses a custom button to prevent closing the dialog after failure
	// This is also to use a custom loading state for the async install method
	showDialog({
		title: Strings.UNBOUND_INSTALL_TITLE.format({ type: manager.type }),
		content: Strings.UNBOUND_ADDON_VALID_MANIFEST.format({ type: manager.type }),
		component: (
			<InstallInput
				type={type}
				ref={ref}
			/>
		),
		componentMargin: false,
		cancelButton: false
	});
}

export default { InstallInput, InternalInstallInput };