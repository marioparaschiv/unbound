import { Constants, Theme, React } from '@metro/common';
import type { Addon, Manager } from '@typings/managers';
import { Component, type ReactElement } from 'react';
import { TintedIcon, Switch } from '@ui/misc/forms';
import { Icons, getIDByName } from '@api/assets';
import { Design } from '@metro/components';
import { Text, View } from 'react-native';
import Overflow from '@ui/misc/overflow';
import * as managers from '@managers';
import { Strings } from '@api/i18n';

import useStyles from './addon-card.style';

interface AddonCardProps {
	type: Manager;
	showToggles: boolean;
	showManagerIcon?: ((addon: Addon) => boolean) | boolean;
	recovery: boolean;
	addon: Addon;
	navigation: any;
	bottom?: ReactElement;
	onPress?: Fn;
	arrow?: boolean;
}

type InternalAddonCardProps = AddonCardProps & {
	styles: ReturnType<typeof useStyles>;
};

class InternalAddonCard extends Component<InternalAddonCardProps> {
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
		const { addon, recovery, onPress, styles, showToggles, showManagerIcon, bottom, arrow } = this.props;
		const { name, version, description } = addon.data;
		const error = this.manager.errors.get(addon.id ?? addon.data.path);

		return (
			<Design.Card
				key={addon.data.id}
				border={'faint'}
				shadow={'low'}
				variant={'primary'}
				onPress={onPress}
				style={{
					marginTop: 12,
					padding: 12,
					...(addon.failed ? styles.failed : {}),
					...(recovery ? styles.recovery : {}),
				}}
			>
				<View style={{ marginLeft: 8, justifyContent: 'center' }}>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<TintedIcon
							source={this.source}
							size={16}
						/>
						<Text style={[styles.header, { marginHorizontal: 8 }]}>
							{name}
						</Text>
						<Text style={[styles.description, { fontSize: 20, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>
							{version}
						</Text>
						<View style={{ flexGrow: 1 }} />
						{this.renderOverflow()}
						{showToggles && this.renderSwitch()}
						{arrow && (
							<TintedIcon
								source={Icons['ic_arrow_right']}
								size={24}
							/>
						)}
					</View>
					<Text style={styles.description}>
						{description ?? Strings.UNBOUND_ADDON_NO_DESCRIPTION}
					</Text>
					{addon.failed && (
						<Text style={[styles.description, { color: Theme.unsafe_rawColors.RED_500 }]}>
							{Strings.UNBOUND_ADDON_FAILED.format({ error: error.message })}
						</Text>
					)}
				</View>
				{bottom}
				<View style={{ marginBottom: 4 }} />
				{(typeof showManagerIcon === 'function' ? showManagerIcon(addon) : showManagerIcon) && (
					<View style={{
						position: 'absolute',
						right: 0,
						bottom: 0,
						backgroundColor: Theme.unsafe_rawColors.BRAND_500,
						borderBottomRightRadius: 10,
						borderTopLeftRadius: 14,
						padding: 6
					}}>
						<TintedIcon
							source={Icons[this.manager.icon]}
							size={16}
						/>
					</View>
				)}
			</Design.Card>
		);
	}

	renderOverflow() {
		const { addon, navigation } = this.props;
		const items = this.manager.getContextItems(addon, navigation);

		if (!items || items.length < 1) return null;

		return <Overflow
			title={addon.data.name}
			items={items.map(item => {
				return {
					...item,
					label: Strings[item.label],
					iconSource: Icons[item.icon]
				};
			})}
		/>;
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
}

export default function AddonCard(props: AddonCardProps) {
	const styles = useStyles();

	return <InternalAddonCard styles={styles} {...props} />;
}