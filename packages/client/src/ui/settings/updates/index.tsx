import { automaticUpdates } from '~/updates/addon-updates';
import { useUnboundSettings } from '~/settings/unbound';
import type { UpdatesState } from '~/updates/state';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import UpdatesStore from '~/updates/state';
import Page from '~/ui/components/page';
import { icons } from '~/assets/api';

import LoaderUpdateRow from './loader-update-row';
import UpdateRow from './update-row';
import { fromNow } from './format';

function describeStatus(state: UpdatesState): string {
	switch (state.status) {
		case 'idle':
			return messages.UNBOUND_UPDATES_NOT_CHECKED;
		case 'checking':
			return messages.UNBOUND_UPDATES_CHECKING;
		case 'error':
			return format('UNBOUND_UPDATES_CHECK_FAILED', { error: state.error });
		case 'ready':
			return format('UNBOUND_UPDATES_CHECKED', { date: fromNow(state.checkedAt) });
	}
}

/** @description Addon and loader updates: check, apply one or all, and read each update's changelog. */
function UpdatesPage() {
	const settings = useUnboundSettings();
	const state = UpdatesStore((store) => store.state);
	const { check, applyAll } = UpdatesStore.getState();
	const updates = state.status === 'ready' ? state.updates : [];
	const loader = state.status === 'ready' ? state.loader : null;
	const pending = updates.length > 0 || loader !== null;
	// Held addons keep their own Update button but sit out Update all.
	const automatic = automaticUpdates(updates, (kind) => Manager.for(kind));

	return (
		<Page>
			<Discord.TableRowGroup helperText={describeStatus(state)}>
				<Discord.TableRow
					label={messages.UNBOUND_UPDATES_CHECK}
					icon={<Discord.TableRowIcon source={icons.RetryIcon} />}
					disabled={state.status === 'checking'}
					onPress={() => void check()}
				/>
				{automatic.length ? (
					<Discord.TableRow
						label={format('UNBOUND_UPDATES_ALL', { count: automatic.length })}
						icon={<Discord.TableRowIcon source={icons.DownloadIcon} />}
						onPress={() => void applyAll()}
					/>
				) : null}
				<Discord.TableSwitchRow
					label={messages.UNBOUND_UPDATES_AUTO}
					subLabel={messages.UNBOUND_UPDATES_AUTO_DESC}
					icon={<Discord.TableRowIcon source={icons.ClockIcon} />}
					value={settings.get('updater.auto')}
					onValueChange={(value) => settings.set('updater.auto', value)}
				/>
			</Discord.TableRowGroup>

			{state.status === 'ready' ? (
				<Discord.TableRowGroup
					title={messages.UNBOUND_UPDATES_AVAILABLE}
					helperText={pending ? messages.UNBOUND_UPDATES_AVAILABLE_DESC : undefined}
				>
					{loader ? <LoaderUpdateRow update={loader} /> : null}
					{updates.map((entry) => (
						<UpdateRow key={entry.id} entry={entry} />
					))}
					{pending ? null : (
						<Discord.TableRow
							label={messages.UNBOUND_UPDATES_UP_TO_DATE}
							icon={<Discord.TableRowIcon source={icons.CircleCheckIcon} />}
							disabled
						/>
					)}
				</Discord.TableRowGroup>
			) : null}
		</Page>
	);
}

export default UpdatesPage;
