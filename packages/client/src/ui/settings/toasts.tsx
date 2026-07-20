import { View } from 'react-native';

import { Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import { Page } from '~/ui/components';
import { Messages } from '~/api/i18n';
import { Icons } from '~/api/assets';

/** @description Formats a toast duration for its settings row. */
function formatDuration(duration: number): string {
	if (duration === 0) return Messages.UNBOUND_INDEFINITE;

	return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(duration / 1000)}s`;
}

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
					icon={<Discord.TableRowIcon source={Icons.BellIcon} />}
					value={settings.get('toasts.enabled', true)}
					onValueChange={() => settings.toggle('toasts.enabled', true)}
				/>
				<Discord.TableSwitchRow
					label={Messages.UNBOUND_TOASTS_ANIMATIONS}
					icon={<Discord.TableRowIcon source={Icons.EyeIcon} />}
					value={settings.get('toasts.animations', true)}
					onValueChange={() => settings.toggle('toasts.animations', true)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_TOAST_SETTINGS}>
				<Discord.TableRow
					label={
						<View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
							<Discord.Text
								variant='text-md/semibold'
								color='mobile-text-heading-primary'
							>
								{Messages.UNBOUND_TOASTS_MAX_ON_SCREEN}
							</Discord.Text>
							<Discord.Text
								variant='text-sm/medium'
								color='text-muted'
								style={{ marginLeft: 'auto' }}
							>
								{Math.floor(settings.get('toasts.maxOnScreen', 3))}
							</Discord.Text>
						</View>
					}
					subLabel={
						<Discord.Slider
							value={settings.get('toasts.maxOnScreen', 3)}
							minimumValue={0}
							maximumValue={10}
							onValueChange={(value: number) =>
								settings.set('toasts.maxOnScreen', value)
							}
						/>
					}
				/>
				<Discord.TableRow
					label={
						<View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
							<Discord.Text
								variant='text-md/semibold'
								color='mobile-text-heading-primary'
							>
								{Messages.UNBOUND_TOASTS_DURATION}
							</Discord.Text>
							<Discord.Text
								variant='text-sm/medium'
								color='text-muted'
								style={{ marginLeft: 'auto' }}
							>
								{formatDuration(settings.get('toasts.duration', 5000))}
							</Discord.Text>
						</View>
					}
					subLabel={
						<Discord.Slider
							value={settings.get('toasts.duration', 5000)}
							minimumValue={0}
							maximumValue={10000}
							onValueChange={(value: number) =>
								settings.set('toasts.duration', value)
							}
						/>
					}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ToastsPage;
