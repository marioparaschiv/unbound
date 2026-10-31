import { View } from 'react-native';

import { useUnboundSettings } from '~/settings/unbound';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

/** @description Formats a toast duration for its settings row. */
function formatDuration(duration: number): string {
	if (duration === 0) {
		return messages.UNBOUND_INDEFINITE;
	}

	return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(duration / 1000)}s`;
}

/**
 * @description Settings page controlling toast behaviour and appearance.
 */
function ToastsPage() {
	const settings = useUnboundSettings(({ key }) => key?.startsWith('toasts'));

	return (
		<Page>
			<Discord.TableRowGroup title={messages.UNBOUND_TOAST_SETTINGS}>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_TOASTS_ENABLED}
					icon={<Discord.TableRowIcon source={icons.BellIcon} />}
					value={settings.get('toasts.enabled')}
					onValueChange={() => settings.toggle('toasts.enabled')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_TOASTS_ANIMATIONS}
					icon={<Discord.TableRowIcon source={icons.EyeIcon} />}
					value={settings.get('toasts.animations')}
					onValueChange={() => settings.toggle('toasts.animations')}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_TOASTS_BEHAVIOR}>
				<Discord.TableRow
					label={
						<View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
							<Discord.Text
								variant='text-md/semibold'
								color='mobile-text-heading-primary'
							>
								{messages.UNBOUND_TOASTS_MAX_ON_SCREEN}
							</Discord.Text>
							<Discord.Text
								variant='text-sm/medium'
								color='text-muted'
								style={{ marginLeft: 'auto' }}
							>
								{Math.floor(settings.get('toasts.maxOnScreen'))}
							</Discord.Text>
						</View>
					}
					subLabel={
						<Discord.Slider
							value={settings.get('toasts.maxOnScreen')}
							minValue={0}
							maxValue={10}
							minimumValue={0}
							maximumValue={10}
							step={1}
							onChange={(value: number) => settings.set('toasts.maxOnScreen', value)}
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
								{messages.UNBOUND_TOASTS_DURATION}
							</Discord.Text>
							<Discord.Text
								variant='text-sm/medium'
								color='text-muted'
								style={{ marginLeft: 'auto' }}
							>
								{formatDuration(settings.get('toasts.duration'))}
							</Discord.Text>
						</View>
					}
					subLabel={
						<Discord.Slider
							value={settings.get('toasts.duration')}
							minValue={0}
							maxValue={10000}
							minimumValue={0}
							maximumValue={10000}
							step={100}
							onChange={(value: number) => settings.set('toasts.duration', value)}
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
