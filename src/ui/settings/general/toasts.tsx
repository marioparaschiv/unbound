import { Section, useFormStyles } from '@ui/misc/forms';
import { ScrollView, Text, View } from 'react-native';
import { Design, Slider } from '@metro/components';
import { Constants, Theme } from '@metro/common';
import { useSettingsStore } from '@api/storage';
import { showToast } from '@api/toasts';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { noop } from '@utilities';
import { useState } from 'react';

const { TableRow, TableSwitchRow, TableRowIcon } = Design;

function Toasts() {
	const [alternate, setAlternate] = useState(true);
	const settings = useSettingsStore('unbound');
	const { endStyle, formHint, formText } = useFormStyles();

	const duration = settings.get('toasts.duration', 0);
	const opacity = settings.get('toasts.opacity', 0.8);
	const blur = settings.get('toasts.blur', 0.15);

	return <ScrollView>
		<Section>
			<TableSwitchRow
				label={Strings.UNBOUND_ENABLED}
				subLabel={Strings.UNBOUND_TOASTS_DESC}
				icon={<TableRowIcon source={Icons['ic_notification_settings']} />}
				value={settings.get('toasts.enabled', true)}
				onValueChange={() => settings.toggle('toasts.enabled', true)}
			/>
			<TableSwitchRow
				label={Strings.UNBOUND_TOASTS_ANIMATIONS}
				subLabel={Strings.UNBOUND_TOASTS_ANIMATIONS_DESC}
				icon={<TableRowIcon source={Icons['ic_wand']} />}
				value={settings.get('toasts.animations', true)}
				onValueChange={() => settings.toggle('toasts.animations', true)}
			/>
		</Section>
		<Section>
			<TableRow
				label={Strings.UNBOUND_TOAST_BACKGROUND_BLUR}
				trailing={(
					<Text style={formText}>
						{`${Math.round(blur * 100)}%`}
					</Text>
				)}
			/>
			<View style={endStyle}>
				<Slider
					style={{ marginHorizontal: 15, marginVertical: 5 }}
					value={blur}
					onValueChange={v => settings.set('toasts.blur', Math.round(v * 100) / 100)}
					minimumValue={0}
					maximumValue={1}
					minimumTrackTintColor={Theme.unsafe_rawColors.BRAND_500}
					maximumTrackTintColor={Constants.UNSAFE_Colors.GREY2}
					tapToSeek
				/>
			</View>
		</Section>
		<Section>
			<TableRow
				label={Strings.UNBOUND_TOAST_BACKGROUND_OPACITY}
				trailing={(
					<Text style={formText}>
						{`${Math.round(opacity * 100)}%`}
					</Text>
				)}
			/>
			<View style={endStyle}>
				<Slider
					style={{ marginHorizontal: 15, marginVertical: 5 }}
					value={opacity}
					onValueChange={v => settings.set('toasts.opacity', Math.round(v * 100) / 100)}
					minimumValue={0}
					maximumValue={1}
					minimumTrackTintColor={Theme.unsafe_rawColors.BRAND_500}
					maximumTrackTintColor={Constants.UNSAFE_Colors.GREY2}
					tapToSeek
				/>
			</View>
		</Section>
		<Section>
			<TableRow
				label={Strings.UNBOUND_TOAST_DURATION}
				trailing={(
					<Text style={formText}>
						{duration === 0 ? Strings.UNBOUND_INDEFINITE : Strings.DURATION_SECONDS.format({ seconds: duration })}
					</Text>
				)}
			/>
			<View style={endStyle}>
				<Slider
					style={{ marginHorizontal: 15, marginVertical: 5 }}
					value={duration}
					onValueChange={v => settings.set('toasts.duration', Math.round(v * 10) / 10)}
					minimumValue={0}
					maximumValue={10}
					minimumTrackTintColor={Theme.unsafe_rawColors.BRAND_500}
					maximumTrackTintColor={Constants.UNSAFE_Colors.GREY2}
					tapToSeek
				/>
			</View>
		</Section>
		<Text style={formHint}>
			{Strings.UNBOUND_TOAST_DURATION_DESC}
		</Text>
		<Section>
			<TableRow
				arrow={true}
				label={'Show Toast'}
				icon={<TableRowIcon source={Icons['ic_star_filled']} />}
				onPress={() => {
					const toast = showToast({
						get title() {
							return Strings[`UNBOUND_${alternate ? 'TOASTS' : 'TESTING'}`];
						},

						get content() {
							return Strings[`UNBOUND_TOASTS_EXAMPLE_CONTENT_${alternate ? 'ALTERNATE' : 'PRIMARY'}`];
						},

						icon: alternate ? 'ic_star_filled' : 'StarIcon'
					});

					setAlternate(p => !p);

					// Add buttons after the toast has loaded to allow for using toast.close
					toast.update({
						buttons: alternate ? [
							{
								get content() {
									return Strings.CLOSE;
								},

								onPress: toast.close,
							},
							{
								get content() {
									return Strings.NONE;
								},

								onPress: noop,
								variant: 'tertiary'
							}
						] : []
					});

					setTimeout(
						() => toast.update({
							get title() {
								return Strings[`UNBOUND_TOASTS_EXAMPLE_TITLE_UPDATE_${alternate ? 'ALTERNATE' : 'PRIMARY'}`];
							},

							get content() {
								return Strings[`UNBOUND_TOASTS_EXAMPLE_CONTENT_UPDATE_${alternate ? 'ALTERNATE' : 'PRIMARY'}`];
							},

							icon: alternate ? 'smile' : 'MusicIcon',
							buttons: [
								{
									get content() {
										return Strings[alternate ? 'CLOSE' : 'NONE'];
									},

									onPress: alternate ? toast.close : noop,
									variant: 'primary'
								}
							]
						}),
						(settings.get('toasts.duration', 3) * 0.5) * 1000
					);
				}}
			/>
		</Section>
	</ScrollView>;
}

export default Toasts;
