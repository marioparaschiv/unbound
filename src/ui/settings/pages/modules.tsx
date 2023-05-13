import { useSettingsStore } from '@api/storage';
import { Forms } from '@metro/components';
import { i18n } from '@metro/common';
import Assets from '@api/assets';


export default function () {
	const settings = useSettingsStore('unbound');

	const Icons = {
		Debug: Assets.getIDByName('debug'),
		Sparkle: Assets.getIDByName('ic_sparkle3')
	};

	return <ReactNative.ScrollView>
		<Forms.FormSection title={i18n.Messages.UNBOUND_DEBUG_BRIDGE}>

		</Forms.FormSection>
	</ReactNative.ScrollView>;
}