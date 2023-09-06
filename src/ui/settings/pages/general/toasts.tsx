import { Section, Row, SwitchRow, RowIcon, useEndStyle } from '@ui/components/form-handler';
import { Constants, Theme, i18n } from '@metro/common';
import { Slider, Forms } from '@metro/components';
import { useSettingsStore } from '@api/storage';
import { showToast } from '@api/toasts';
import { Icons } from '@api/assets';
import { noop } from '@utilities';

function Toasts() {
	const settings = useSettingsStore('unbound');
	const endStyle = useEndStyle();

	const duration = settings.get('toasts.duration', 0);

	return <ReactNative.ScrollView>
		<Section>
			<SwitchRow
				label={i18n.Messages.UNBOUND_ENABLED}
				subLabel={i18n.Messages.UNBOUND_TOASTS_DESC}
				icon={<RowIcon source={settings.get('toasts.enabled', true) ? Icons['Check'] : Icons['Small']} />}
				value={settings.get('toasts.enabled', true)}
				onValueChange={() => settings.toggle('toasts.enabled', true)}
			/>
			<SwitchRow
				label={i18n.Messages.UNBOUND_TOASTS_ANIMATIONS}
				subLabel={i18n.Messages.UNBOUND_TOASTS_ANIMATIONS_DESC}
				icon={<RowIcon source={settings.get('toasts.animations', true) ? Icons['pause'] : Icons['play']} />}
				value={settings.get('toasts.animations', true)}
				onValueChange={() => settings.toggle('toasts.animations', true)}
			/>
			<Row
				arrow={true}
				label={'Show Toast'}
				icon={<RowIcon source={Icons['img_nitro_star']} />}
				onPress={() => {
					const toast = showToast({
						title: 'Test',
						content: 'Toast example',
						icon: 'img_nitro_star'
					});

					// Add buttons after the toast has loaded to allow for using toast.close
					toast.update({
						buttons: [
							{
								content: 'Close',
								onPress: toast.close,
							},
							{
								content: 'No-op',
								onPress: noop,
								variant: 'primary-alt'
							}
						]
					})

					setTimeout(
						() => toast.update({
							title: 'Updated',
							content: 'The toast can update!'
						}),
						(settings.get('toasts.duration', 3) - 1) * 1000
					)
				}}
			/>
		</Section>
		<Section>
			<Row
				label={i18n.Messages.UNBOUND_TOAST_DURATION}
				trailing={(
					<Forms.FormText size={Forms.FormTextSizes.MEDIUM}>
						{duration === 0 ? i18n.Messages.UNBOUND_INDEFINITE : i18n.Messages.DURATION_SECONDS.format({ seconds: duration })}
					</Forms.FormText>
				)}
			/>
			<ReactNative.View style={endStyle}>
				<Slider
					style={{ marginHorizontal: 15, marginVertical: 5 }}
					value={duration}
					onValueChange={v => settings.set('toasts.duration', Math.round(v))}
					minimumValue={0}
					maximumValue={10}
					minimumTrackTintColor={Theme.unsafe_rawColors.BRAND_500}
					maximumTrackTintColor={Constants.UNSAFE_Colors.GREY2}
					tapToSeek
				/>
			</ReactNative.View>
		</Section>
		<Forms.FormHint>
			{i18n.Messages.UNBOUND_TOAST_DURATION_DESC}
		</Forms.FormHint>
	</ReactNative.ScrollView>;
}

export default Toasts;