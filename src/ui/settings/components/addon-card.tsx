import { Constants, Theme, React, ReactNative as RN, StyleSheet, i18n } from '@metro/common';
import { capitalize, mergeStyles } from '@utilities';
import { showAlert } from '@api/dialogs';
import { Addon, Author } from '@typings/managers';
import { AsyncUsers } from '@metro/api';
import { Users } from '@metro/stores';
import { Profiles } from '@metro/ui';
import { reload } from '@api/native';
import { Icons, getIDByName } from '@api/assets';
import { get } from '@api/storage';
import { Keys } from '@constants';
import { Theme as ThemeStore } from '@metro/stores';

import { ManagerType } from '@managers/base';
import Plugins from '@managers/plugins';
import Themes from '@managers/themes';
import Overflow from '@ui/settings/components/overflow';
import { Redesign } from '@metro/components';

const { colors, meta: { resolveSemanticColor } } = Theme;

interface AddonCardProps {
	manager: typeof Plugins | typeof Themes;
	shouldRestart: boolean;
	recovery: boolean;
	addon: Addon;
	navigation: any;
}

const showRestartAlert = () => showAlert({
	title: i18n.Messages.UNBOUND_CHANGE_RESTART,
	content: i18n.Messages.UNBOUND_CHANGE_RESTART_DESC,
	buttons: [
		{
			text: i18n.Messages.UNBOUND_RESTART,
			onPress: () => {
				Redesign.dismissAlerts();
				reload();
			}
		}
	]
});

export default class extends React.Component<AddonCardProps> {
	render() {
		const { addon, recovery } = this.props;

		return <RN.View style={mergeStyles(this.styles.card, addon.failed && this.styles.failed, recovery && this.styles.recovery)}>
			<RN.View style={this.styles.header}>
				{this.renderMetadata()}
				{this.renderAuthors()}
				{this.renderOverflow()}
				{this.renderSwitch()}
			</RN.View>
			<RN.View style={this.styles.info}>
				{this.renderBody()}
			</RN.View>
		</RN.View>;
	}

	renderIcon() {
		const { addon, manager } = this.props;

		if (addon.data.icon === '__custom__'
			&& addon.instance.icon
			&& manager.type === ManagerType.Plugins
		) {
			return React.createElement(addon.instance.icon);
		}

		return <RN.Image
			source={getIDByName((() => {
				if (addon.data.icon) return addon.data.icon;

				switch (manager.type) {
					case ManagerType.Plugins:
						return 'StaffBadgeIcon';
					case ManagerType.Themes:
						return 'CreativeIcon';
					default:
						return 'CircleQuestionIcon'
				}
			})())}
			style={{
				width: 16,
				aspectRatio: 1,
				marginRight: 8,
				tintColor: resolveSemanticColor(ThemeStore.theme, colors.INTERACTIVE_NORMAL)
			}}
		/>
	}

	renderOverflow() {
		const { addon, manager, navigation } = this.props;

		return <Overflow
			items={[
				...manager.type === ManagerType.Plugins && addon.instance?.settings ? [
					{
						label: i18n.Messages.SETTINGS,
						iconSource: Icons['settings'],
						action: () => navigation.push(Keys.Custom, {
							title: addon.data.name,
							render: addon.instance.settings
						})
					}
				] : [],
				{
					label: i18n.Messages.UNBOUND_UNINSTALL,
					iconSource: Icons['trash'],
					action: () => showAlert({
						title: i18n.Messages.UNBOUND_UNINSTALL_ADDON.format({ type: capitalize(manager.type) }),
						content: i18n.Messages.UNBOUND_UNINSTALL_ADDON_DESC.format({ name: addon.data.name }),
						buttons: [
							{
								text: i18n.Messages.UNBOUND_UNINSTALL,
								onPress: async () => {
									await manager.delete(addon.id);

									if (manager.type === ManagerType.Themes && get('theme-states', 'applied', '') === addon.data.id) {
										showRestartAlert();
									}
								}
							}
						]
					})
				}
			]}
		/>
	}

	renderMetadata() {
		const { addon } = this.props;

		return <>
			{this.renderIcon()}
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

	renderSwitch() {
		const { addon, manager, shouldRestart, recovery } = this.props;

		return <RN.Switch
			disabled={addon.failed || recovery}
			value={manager.isEnabled(addon.id)}
			trackColor={{
				false: Theme.colors.BACKGROUND_FLOATING,
				true: Theme.colors.HEADER_PRIMARY
			}}
			onChange={() => {
				manager.toggle(addon.id);

				if (shouldRestart) {
					showRestartAlert();
				}
			}}
		/>
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
			borderRadius: 12,
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
			borderTopRightRadius: 12,
			borderTopLeftRadius: 12,
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
		},
		icon: {
			width: 22,
			height: 22,
			tintColor: Theme.colors.INTERACTIVE_NORMAL
		}
	});
}