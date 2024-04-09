import { Constants, Theme, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Icons, getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';

import Overflow from '@ui/components/overflow';

import type { Addon, Author, Manager } from '@typings/managers';
import * as managers from '@managers';
import { TintedIcon, Switch } from '@ui/components/misc';
import type { ReactElement } from 'react';
import { Redesign } from '@metro/components';

interface AddonCardProps {
	type: Manager;
	showToggles: boolean;
	recovery: boolean;
	addon: Addon;
	navigation: any;
	bottom?: ReactElement
	onPress?: Fn
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
		const { addon, recovery, onPress, styles, showToggles, bottom, arrow } = this.props;
		const { name, version, description } = addon.data;
		const error = this.manager.errors.get(addon.id ?? addon.data.path);

		return <Redesign.Card
			key={addon.data.id}
			border={'faint'}
			shadow={'low'}
			variant={'primary'}
			onPress={onPress}
			style={{
				marginTop: 12,
				...addon.failed ? styles.failed : {},
				...recovery ? styles.recovery : {},
			}}
		>
			<RN.View style={{ marginLeft: 8, justifyContent: 'center', gap: 10 }}>
				<RN.View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<RN.Text style={[styles.header, { marginRight: 8 }]}>
						{name}
					</RN.Text>
					<RN.Text style={[styles.description, { fontSize: 20, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>
						{version}
					</RN.Text>
					<RN.View style={{ flexGrow: 1 }} />
					{this.renderOverflow()}
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
					source={this.source}
					size={20}
				/>
			</RN.View>
		</Redesign.Card>;
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