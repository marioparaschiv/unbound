import { Constants, Theme, React, ReactNative as RN, StyleSheet, i18n } from '@metro/common';
import { Addon, Author } from '@typings/managers';
import { capitalize, mergeStyles } from '@utilities';
import { AsyncUsers } from '@metro/api';
import { Users } from '@metro/stores';
import { reload } from '@api/native';
import { Profiles } from '@metro/ui';
import Dialog, { showConfirmationAlert } from '@api/dialogs';

import Plugins from '@managers/plugins';
import Themes from '@managers/themes';
import { Icons } from '@api/assets';

interface AddonCardProps {
	manager: typeof Plugins | typeof Themes;
	shouldRestart: boolean;
	recovery: boolean;
	addon: Addon;
}

export default class extends React.Component<AddonCardProps> {
	render() {
		const { addon, recovery } = this.props;

		return <RN.View style={mergeStyles(this.styles.card, addon.failed && this.styles.failed, recovery && this.styles.recovery)}>
			<RN.View style={this.styles.header}>
				{this.renderMetadata()}
				{this.renderAuthors()}
				{this.renderControls()}
			</RN.View>
			<RN.View style={this.styles.info}>
				{this.renderBody()}
			</RN.View>
		</RN.View>;
	}

	renderMetadata() {
		const { addon } = this.props;

		return <>
			<RN.Text style={this.styles.name}>
				{addon.data.name}
			</RN.Text>
			<RN.Text style={this.styles.version}>
				{addon.data.version ?? '?.?.?'}
			</RN.Text>
		</>;
	}

	renderAuthors() {
		const { addon } = this.props;

		return <>
			<RN.Text style={this.styles.by}>by</RN.Text>
			<RN.FlatList
				data={addon.data.authors ?? [{ name: '???' }] as any}
				horizontal
				style={{ flex: 1 }}
				keyExtractor={(_, idx) => String(idx)}
				renderItem={({ item, index }) => {
					const isLast = index === (addon.data.authors?.length || 1) - 1;

					const divider = !isLast && <RN.Text style={this.styles.authors}>
						{', '}
					</RN.Text>;

					if (item.name && item.id) {
						return <RN.TouchableOpacity style={this.styles.authorContainer} onPress={this.onTapAuthor.bind(this, item)}>
							<RN.Text style={mergeStyles(this.styles.authors, this.styles.touchable)}>
								{item.name}
							</RN.Text>
							{divider}
						</RN.TouchableOpacity>;
					} else {
						return <RN.View style={this.styles.authorContainer}>
							<RN.Text style={this.styles.authors}>
								{(item.name ?? item) as String}
							</RN.Text>
							{divider}
						</RN.View>;
					}
				}}
			/>
		</>;
	}

	renderControls() {
		const { addon, manager, shouldRestart, recovery } = this.props;

		return <>
			<RN.Pressable
				style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1.0, ...this.styles.controlButton })}
				hitSlop={15}
				onPress={() => {
					showConfirmationAlert({
						title: i18n.Messages.UNBOUND_UNINSTALL_ADDON.format({ type: capitalize(manager.type) }),
						content: i18n.Messages.UNBOUND_UNINSTALL_ADDON_DESC.format({ name: addon.data.name }),
						confirmText: i18n.Messages.UNBOUND_UNINSTALL,
						onConfirm: async () => await manager.delete(addon.id)
					});
				}}
			>
				<RN.Image source={Icons['trash']} />
			</RN.Pressable>
			<RN.Switch
				disabled={addon.failed || recovery}
				value={manager.isEnabled(addon.id)}
				onChange={() => {
					manager.toggle(addon.id);

					if (shouldRestart) {
						showConfirmationAlert({
							title: i18n.Messages.UNBOUND_CHANGE_RESTART,
							content: i18n.Messages.UNBOUND_CHANGE_RESTART_DESC,
							confirmText: i18n.Messages.UNBOUND_RESTART,
							onConfirm: async () => await reload()
						});
					}
				}}
			/>
		</>;
	}

	renderBody() {
		const { addon, manager } = this.props;

		const error = manager.errors.get(addon.id ?? addon.data.path);

		return <>
			<RN.Text style={this.styles.description}>
				{addon.data.description ?? i18n.Messages.UNBOUND_ADDON_NO_DESCRIPTION}
			</RN.Text>
			{addon.failed && <RN.Text style={mergeStyles(this.styles.description, this.styles.error)}>
				{i18n.Messages.UNBOUND_ADDON_FAILED.format({ error: error.message })}
			</RN.Text>}
		</>;
	}

	async onTapAuthor(author: Author) {
		if (!Users.getUser(author.id)) {
			await AsyncUsers.fetchProfile(author.id);
		}

		Profiles.showUserProfile({ userId: author.id });
	}

	styles = StyleSheet.createThemedStyleSheet({
		card: {
			backgroundColor: Theme.colors.BACKGROUND_SECONDARY,
			marginHorizontal: 10,
			borderRadius: 5,
			marginTop: 10
		},
		failed: {
			opacity: 0.5
		},
		error: {
			color: 'red',
			marginTop: 10
		},
		header: {
			backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
			borderTopRightRadius: 5,
			borderTopLeftRadius: 5,
			paddingHorizontal: 15,
			flexDirection: 'row',
			alignItems: 'center',
			padding: 10,
			flex: 1
		},
		name: {
			color: Theme.colors.TEXT_NORMAL,
			fontFamily: Constants.Fonts.PRIMARY_BOLD,
			marginRight: 2.5,
			fontSize: 16,
		},
		version: {
			fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
			color: Theme.colors.TEXT_MUTED,
			marginRight: 2.5,
			fontSize: 14
		},
		by: {
			fontFamily: Constants.Fonts.PRIMARY_NORMAL,
			color: Theme.colors.TEXT_MUTED,
			marginRight: 2.5,
			fontSize: 14
		},
		authors: {
			fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
			color: Theme.colors.TEXT_MUTED,
			fontSize: 14,
			flex: 1
		},
		authorContainer: {
			flexDirection: 'row'
		},
		touchable: {
			color: Theme.colors.TEXT_NORMAL
		},
		info: {
			padding: 15,
		},
		description: {
			fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
			color: Theme.colors.TEXT_NORMAL,
			fontSize: 14
		},
		recovery: {
			opacity: 0.5,
			pointerEvents: 'none'
		},
		controlButton: {
			marginRight: ReactNative.Platform.select({
				android: 2.5,
				ios: 10
			})
		}
	});
}