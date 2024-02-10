import { Constants, Theme, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { mergeStyles } from '@utilities';
import { showAlert } from '@api/dialogs';
import { AsyncUsers } from '@metro/api';
import { Users } from '@metro/stores';
import { Profiles } from '@metro/api';
import { reload } from '@api/native';
import { Icons, getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';


import { ManagerType } from '@managers/base';
import { Redesign } from '@metro/components';
import Overflow from '@ui/components/overflow';

import type { Addon, Author, Manager } from '@typings/managers';
import { managers } from '@api';
import { Switch } from '@ui/components/misc';

interface AddonCardProps {
	type: Manager;
	shouldRestart: boolean;
	showToggles: boolean;
	recovery: boolean;
	addon: Addon;
	navigation: any;
}

type InternalAddonCardProps = AddonCardProps & {
	styles: ReturnType<typeof useStyles>;
};

class InternalAddonCard extends React.Component<InternalAddonCardProps> {
	get manager() {
		return managers[this.props.type];
	}

	get source() {
		const { addon } = this.props;

		return addon.data.icon
			? typeof addon.data.icon === 'string'
				? getIDByName(addon.data.icon)
				: addon.data.icon
			: getIDByName(this.manager.icon ?? 'CircleQuestionIcon');
	}

	render() {
		const { addon, recovery, styles } = this.props;

		return <RN.View style={mergeStyles(styles.card, addon.failed && styles.failed, recovery && styles.recovery)}>
			<RN.View style={styles.header}>
				{this.renderMetadata()}
				{this.renderAuthors()}
				{this.renderOverflow()}
				{this.props.showToggles && this.renderSwitch()}
			</RN.View>
			<RN.View style={styles.info}>
				{this.renderBody()}
			</RN.View>
		</RN.View>;
	}

	renderIcon() {
		const { addon, styles } = this.props;

		if (addon.data.icon === '__custom__' && addon.instance.icon && this.manager.type === ManagerType.Plugins) {
			return React.createElement(addon.instance.icon);
		}

		return <RN.Image
			source={this.source}
			style={styles.icon}
		/>;
	}

	renderOverflow() {
		const { addon, navigation } = this.props;
		const items = this.manager.getContextItems(addon, navigation);

		if (!items || items.length < 1) return null;

		return <Overflow
			items={this.manager.getContextItems(addon, navigation).map(item => {
				return {
					...item,
					label: Strings[item.label],
					iconSource: Icons[item.icon]
				};
			})}
		/>;
	}

	renderMetadata() {
		const { addon, styles } = this.props;

		return <>
			{this.renderIcon()}
			<RN.Text style={styles.name}>
				{addon.data.name}
			</RN.Text>
			<RN.Text style={styles.version}>
				{addon.data.version ?? '?.?.?'}
			</RN.Text>
		</>;
	}

	renderAuthors() {
		const { addon, styles } = this.props;

		return <>
			<RN.Text style={styles.by}>by</RN.Text>
			<RN.FlatList
				data={addon.data.authors ?? [{ name: '???' }] as any}
				horizontal
				style={{ flex: 1 }}
				keyExtractor={(_, idx) => String(idx)}
				renderItem={({ item, index }) => {
					const isLast = index === (addon.data.authors?.length || 1) - 1;

					const divider = !isLast && <RN.Text style={styles.authors}>
						{', '}
					</RN.Text>;

					if (item.name && item.id) {
						return <RN.TouchableOpacity style={styles.authorContainer} onPress={this.onTapAuthor.bind(this, item)}>
							<RN.Text style={mergeStyles(styles.authors, styles.touchable)}>
								{item.name}
							</RN.Text>
							{divider}
						</RN.TouchableOpacity>;
					} else {
						return <RN.View style={styles.authorContainer}>
							<RN.Text style={styles.authors}>
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
		const { addon, recovery } = this.props;

		return <Switch.FormSwitch
			disabled={addon.failed || recovery}
			value={this.manager.isEnabled(addon.id)}
			trackColor={{
				false: Theme.colors.BACKGROUND_FLOATING,
				true: Theme.colors.HEADER_PRIMARY
			}}
			onValueChange={() => {
				this.manager.toggle(addon.id);
			}}
		/>;
	}

	renderBody() {
		const { addon, styles } = this.props;

		const error = this.manager.errors.get(addon.id ?? addon.data.path);

		return <>
			<RN.Text style={styles.description}>
				{addon.data.description ?? Strings.UNBOUND_ADDON_NO_DESCRIPTION}
			</RN.Text>
			{addon.failed && <RN.Text style={mergeStyles(styles.description, styles.error)}>
				{Strings.UNBOUND_ADDON_FAILED.format({ error: error.message })}
			</RN.Text>}
		</>;
	}

	async onTapAuthor(author: Author) {
		if (!Users.getUser(author.id)) {
			await AsyncUsers.fetchProfile(author.id);
		}

		Profiles.showUserProfile({ userId: author.id });
	}
}

const useStyles = StyleSheet.createStyles({
	card: {
		backgroundColor: Theme.colors.BACKGROUND_SECONDARY,
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
		width: 16,
		aspectRatio: 1,
		marginRight: 8,
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	}
});

export default function AddonCard(props: AddonCardProps) {
	const styles = useStyles();

	return <InternalAddonCard styles={styles} {...props} />;
}