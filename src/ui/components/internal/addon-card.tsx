import { Constants, Theme, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Icons, getIDByName } from '@api/assets';
import { Strings, add } from '@api/i18n';

import Overflow from '@ui/components/overflow';

import type { Addon, Manager } from '@typings/managers';
import { TintedIcon, Switch } from '@ui/components/misc';
import { Redesign } from '@metro/components';
import type { ReactElement } from 'react';
import * as managers from '@managers';

interface AddonCardProps {
	type: Manager;
  showOverflow: boolean;
	showToggles: boolean;
	showManagerIcon?: ((addon: Addon) => boolean) | boolean;
	recovery: boolean;
	addon: Addon;
	navigation: any;
	bottom?: ReactElement;
	onPress?: (addon: Addon) => void;
	arrow?: boolean;
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
		const { addon, recovery, onPress, styles, showOverflow, showToggles, showManagerIcon, bottom, arrow } = this.props;
		const { name, version, description } = addon.data;
		const error = this.manager.errors.get(addon.id ?? addon.data.path);

		return (
			<Redesign.Card
				key={addon.data.id}
				border={'faint'}
				shadow={'low'}
				variant={'primary'}
				onPress={() => onPress(addon)}
				style={{
					marginTop: 12,
					padding: 12,
					...(addon.failed ? styles.failed : {}),
					...(recovery ? styles.recovery : {}),
				}}
			>
				<RN.View style={{ marginLeft: 8, justifyContent: 'center' }}>
					<RN.View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<TintedIcon
							source={this.source}
							size={16}
						/>
						<RN.Text style={[styles.header, { marginHorizontal: 8 }]}>
							{name}
						</RN.Text>
						<RN.Text style={[styles.description, { fontSize: 20, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>
							{version}
						</RN.Text>
						<RN.View style={{ flexGrow: 1 }} />
						{showOverflow && this.renderOverflow()}
						{showToggles && this.renderSwitch()}
						{arrow && (
							<TintedIcon
								source={Icons['ic_arrow_right']}
								size={24}
							/>
						)}
					</RN.View>
					<RN.Text style={styles.description}>
						{description ?? Strings.UNBOUND_ADDON_NO_DESCRIPTION}
					</RN.Text>
					{addon.failed && (
						<RN.Text style={[styles.description, { color: Theme.unsafe_rawColors.RED_500 }]}>
							{Strings.UNBOUND_ADDON_FAILED.format({ error: error.message })}
						</RN.Text>
					)}
				</RN.View>
				{bottom}
				<RN.View style={{ marginBottom: 4 }} />
				{(typeof showManagerIcon === 'function' ? showManagerIcon(addon) : showManagerIcon) && (
					<RN.View style={{
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
					</RN.View>
				)}
			</Redesign.Card>
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

const useStyles = StyleSheet.createStyles({
	failed: {
		opacity: 0.5
	},

	recovery: {
		opacity: 0.5,
		pointerEvents: 'none'
	},

	header: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 20,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		marginBottom: 0
	},

	description: {
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 14,
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		marginBottom: 0
	}
});

export default function AddonCard(props: AddonCardProps) {
	const styles = useStyles();

	return <InternalAddonCard styles={styles} {...props} />;
}
