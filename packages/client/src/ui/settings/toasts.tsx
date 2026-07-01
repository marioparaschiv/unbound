import { View } from 'react-native';

import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { Page } from '~/ui/components';
import { Messages } from '~/api/i18n';

/**
 * @description Settings page controlling toast behaviour and appearance.
 */
function ToastsPage() {
	const settings = useSettingsStore('unbound', ({ key }) => key?.startsWith('toasts'));

	return (
		<Page>
			<Discord.TableRowGroup title={Messages.UNBOUND_TOAST_SETTINGS}>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_TOASTS_ENABLED}
					value={settings.get('toasts.enabled', true)}
					onValueChange={() => settings.toggle('toasts.enabled', true)}
				/>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_TOASTS_ANIMATIONS}
					value={settings.get('toasts.animations', true)}
					onValueChange={() => settings.toggle('toasts.animations', true)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_TOASTS_MAX_ON_SCREEN}>
				<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
					<Discord.Slider
						value={settings.get('toasts.maxOnScreen', 3)}
						minimumValue={0}
						maximumValue={10}
						step={1}
						onValueChange={(value: number) =>
							settings.set('toasts.maxOnScreen', Math.round(value))
						}
					/>
				</View>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_TOASTS_DURATION}>
				<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
					<Discord.Slider
						value={settings.get('toasts.duration', 5000)}
						minimumValue={0}
						maximumValue={10000}
						step={500}
						onValueChange={(value: number) =>
							settings.set('toasts.duration', Math.round(value))
						}
					/>
				</View>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ToastsPage;
