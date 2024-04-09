import { ReactNative as RN, StyleSheet, Theme, Constants } from '@metro/common';
import { AddonPage } from '@ui/settings/sources/addon-page';
import { useIcon, type Bundle } from '@managers/sources';
import { TintedIcon } from '@ui/components/misc';
import { Redesign } from '@metro/components';
import * as Managers from '@managers';
import { Icons } from '@api/assets';
import { Keys } from '@constants';

const useStyles = StyleSheet.createStyles({
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

export function AddonCard({ addon, navigation }: { addon: Bundle[number], navigation: any }) {
	const { manifest: { id, icon: _icon, name, description, version }, type } = addon;
	const icon = useIcon(_icon);
	const styles = useStyles();

	return <Redesign.Card
		key={id}
		border={'faint'}
		shadow={'low'}
		variant={'primary'}
		style={{ marginRight: 8 }}
		onPress={() => navigation.push(Keys.Custom, {
			title: addon.manifest.name,
			render: () => <AddonPage
				addon={addon}
				navigation={navigation}
			/>
		})}
	>
		<RN.View style={{ flexDirection: 'row' }}>
			<TintedIcon
				source={icon}
				size={60}
			/>
			<RN.View style={{ flexDirection: 'column', marginLeft: 8, justifyContent: 'center' }}>
				<RN.View style={{ flexDirection: 'row', marginBottom: 8 }}>
					<RN.Text style={[styles.header, { marginRight: 8 }]}>
						{name}
					</RN.Text>
					<RN.Text style={[styles.description, { fontSize: 20, fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD }]}>
						{version}
					</RN.Text>
				</RN.View>
				<RN.Text style={[styles.description, { marginTop: -8, flexWrap: 'wrap', maxWidth: 148 }]}>
					{description}
				</RN.Text>
			</RN.View>
		</RN.View>
		<RN.View style={{
			position: 'absolute',
			right: 0,
			backgroundColor: Theme.unsafe_rawColors.BRAND_500,
			borderBottomLeftRadius: 10,
			borderTopRightRadius: 14,
			padding: 6
		}}>
			<TintedIcon
				source={Icons[Managers[type].icon]}
				size={12}
			/>
		</RN.View>
	</Redesign.Card>;
}