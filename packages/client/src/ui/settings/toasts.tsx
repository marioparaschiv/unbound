import { getDefault, useUnboundSettings } from '~/settings/unbound';
import SliderRow from '~/ui/settings-kit/slider-row';
import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

import ToastPreview from './toast-preview';

function formatPercent(fraction: number): string {
	return `${Math.round(fraction * 100)}%`;
}

function formatCount(count: number): string {
	return count === 0 ? messages.UNBOUND_UNLIMITED : String(count);
}

function formatDuration(duration: number): string {
	if (duration === 0) {
		return messages.UNBOUND_INDEFINITE;
	}

	return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(duration / 1000)}s`;
}

function showTestToast() {
	show({
		title: messages.UNBOUND_TOASTS_PREVIEW_TITLE,
		content: messages.UNBOUND_TOASTS_PREVIEW_CONTENT,
		icon: 'BellIcon',
	});
}

/**
 * @description Toast settings: a live preview, then whether toasts show, how they look and how long they stay.
 */
function ToastsPage() {
	const settings = useUnboundSettings(({ key }) => key?.startsWith('toasts'));
	const enabled = settings.get('toasts.enabled');
	const opaque = settings.get('toasts.opacity') === 1;

	return (
		<Page>
			<ToastPreview />

			<Discord.TableRowGroup>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_TOASTS_ENABLED}
					subLabel={messages.UNBOUND_TOASTS_ENABLED_DESC}
					icon={<Discord.TableRowIcon source={icons.BellIcon} />}
					value={enabled}
					onValueChange={() => settings.toggle('toasts.enabled')}
				/>
				<Discord.TableSwitchRow
					label={messages.UNBOUND_TOASTS_ANIMATIONS}
					icon={<Discord.TableRowIcon source={icons.SparklesIcon ?? icons.EyeIcon} />}
					value={settings.get('toasts.animations')}
					disabled={!enabled}
					onValueChange={() => settings.toggle('toasts.animations')}
				/>
				<Discord.TableRow
					label={messages.UNBOUND_TOASTS_TEST}
					icon={<Discord.TableRowIcon source={icons.PaperPlaneIcon ?? icons.BellIcon} />}
					disabled={!enabled}
					onPress={showTestToast}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup
				title={messages.UNBOUND_APPEARANCE}
				helperText={opaque ? messages.UNBOUND_TOASTS_BLUR_HINT : undefined}
			>
				<SliderRow
					label={messages.UNBOUND_TOASTS_OPACITY}
					value={settings.get('toasts.opacity')}
					defaultValue={getDefault('toasts.opacity')}
					minimum={0}
					maximum={1}
					step={0.05}
					format={formatPercent}
					onChange={(value) => settings.set('toasts.opacity', value)}
				/>
				<SliderRow
					label={messages.UNBOUND_TOASTS_BLUR}
					value={settings.get('toasts.blur')}
					defaultValue={getDefault('toasts.blur')}
					minimum={0}
					maximum={1}
					step={0.05}
					format={formatPercent}
					onChange={(value) => settings.set('toasts.blur', value)}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup
				title={messages.UNBOUND_TOASTS_BEHAVIOR}
				helperText={messages.UNBOUND_TOASTS_BEHAVIOR_HINT}
			>
				<SliderRow
					label={messages.UNBOUND_TOASTS_MAX_ON_SCREEN}
					value={settings.get('toasts.maxOnScreen')}
					defaultValue={getDefault('toasts.maxOnScreen')}
					minimum={0}
					maximum={10}
					format={formatCount}
					onChange={(value) => settings.set('toasts.maxOnScreen', value)}
				/>
				<SliderRow
					label={messages.UNBOUND_TOASTS_DURATION}
					value={settings.get('toasts.duration')}
					defaultValue={getDefault('toasts.duration')}
					minimum={0}
					maximum={10000}
					step={500}
					format={formatDuration}
					onChange={(value) => settings.set('toasts.duration', value)}
				/>
			</Discord.TableRowGroup>
		</Page>
	);
}

export default ToastsPage;
