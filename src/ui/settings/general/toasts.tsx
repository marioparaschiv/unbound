import { Section, Row, SwitchRow, RowIcon, useEndStyle, Form } from '@ui/components/form';
import { Constants, Theme, ReactNative as RN } from '@metro/common';
import { Slider, Forms } from '@metro/components';
import { useSettingsStore } from '@api/storage';
import { showToast } from '@api/toasts';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { noop } from '@utilities';

function Toasts() {
	const settings = useSettingsStore('unbound');
	const endStyle = useEndStyle();
	const [showButtons, setShowButtons] = React.useState(true);

	const duration = settings.get('toasts.duration', 0);

	return <Form>
		<Section>
			<SwitchRow
				label={Strings.UNBOUND_ENABLED}
				subLabel={Strings.UNBOUND_TOASTS_DESC}
				icon={<RowIcon source={settings.get('toasts.enabled', true) ? Icons['Check'] : Icons['Small']} />}
				value={settings.get('toasts.enabled', true)}
				onValueChange={() => settings.toggle('toasts.enabled', true)}
			/>
			<SwitchRow
				label={Strings.UNBOUND_TOASTS_ANIMATIONS}
				subLabel={Strings.UNBOUND_TOASTS_ANIMATIONS_DESC}
				icon={<RowIcon source={settings.get('toasts.animations', true) ? Icons['pause'] : Icons['play']} />}
				value={settings.get('toasts.animations', true)}
				onValueChange={() => settings.toggle('toasts.animations', true)}
			/>
			<Row
				arrow={true}
				label={'Show Toast'}
				icon={<RowIcon source={Icons['feature_star']} />}
				onPress={() => {
					const toast = showToast({
						title: 'Test',
						content: 'Toast example',
						icon: 'feature_star'
					});

					setShowButtons(p => !p);

					// Add buttons after the toast has loaded to allow for using toast.close
					toast.update({
						buttons: showButtons ? [
							{
								content: 'Close',
								onPress: toast.close,
							},
							{
								content: 'No-op',
								onPress: noop,
								variant: 'primary-alt'
							}
						] : []
					});

					setTimeout(
						() => toast.update({
							title: 'Updated',
							content: 'The toast can update!'
						}),
						(settings.get('toasts.duration', 3) - 1) * 1000
					);
				}}
			/>
		</Section>
		<Section>
			<Row
				label={Strings.UNBOUND_TOAST_DURATION}
				trailing={(
					<Forms.FormText size={Forms.FormTextSizes.MEDIUM}>
						{duration === 0 ? Strings.UNBOUND_INDEFINITE : Strings.DURATION_SECONDS.format({ seconds: duration })}
					</Forms.FormText>
				)}
			/>
			<RN.View style={endStyle}>
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
			</RN.View>
		</Section>
		<Forms.FormHint>
			{Strings.UNBOUND_TOAST_DURATION_DESC}
		</Forms.FormHint>
	</Form>;
}

export default Toasts;