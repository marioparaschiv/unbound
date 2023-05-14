import { Slider, Forms } from '@metro/components';
import { useSettingsStore } from '@api/storage';
import { Constants, Theme } from '@metro/common';
import { i18n } from '@metro/common';
import Assets from '@api/assets';

export default function () {
	const settings = useSettingsStore('unbound');

	const Icons = {
		Debug: Assets.getIDByName('debug'),
		Sparkle: Assets.getIDByName('ic_sparkle3')
	};

	return <ReactNative.ScrollView>
		<Forms.FormSection>
			<Forms.FormRow
				label={i18n.Messages.UNBOUND_ENABLED}
				subLabel={i18n.Messages.UNBOUND_TOASTS_DESC}
				trailing={<Forms.FormSwitch
					value={settings.get('toasts.enabled', true)}
					onValueChange={() => settings.toggle('toasts.enabled', true)}
				/>}
			/>
			<Forms.FormDivider />
			<Forms.FormRow
				label={i18n.Messages.UNBOUND_TOASTS_ANIMATIONS}
				subLabel={i18n.Messages.UNBOUND_TOASTS_ANIMATIONS_DESC}
				trailing={<Forms.FormSwitch
					value={settings.get('toasts.animations', true)}
					onValueChange={() => settings.toggle('toasts.animations', true)}
				/>}
			/>
		</Forms.FormSection>
		<Forms.FormSection>
			<Forms.FormRow
				label={i18n.Messages.UNBOUND_TOAST_DURATION}
				trailing={<Forms.FormText size={Forms.FormTextSizes.MEDIUM}>
					{i18n.Messages.DURATION_SECONDS.format({ seconds: settings.get('toasts.duration', 3) })}
				</Forms.FormText>}
			/>
			<Slider
				style={{ marginHorizontal: 15 }}
				value={settings.get('toasts.duration', 3)}
				onValueChange={v => settings.set('toasts.duration', Math.round(v))}
				minimumValue={3}
				maximumValue={10}
				minimumTrackTintColor={Theme.unsafe_rawColors.BRAND_500}
				maximumTrackTintColor={Constants.UNSAFE_Colors.GREY2}
			/>
		</Forms.FormSection>
		<Forms.FormHint>
			{i18n.Messages.UNBOUND_TOAST_DURATION_DESC}
		</Forms.FormHint>
	</ReactNative.ScrollView>;
}