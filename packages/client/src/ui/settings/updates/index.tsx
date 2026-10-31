import type { PendingUpdate } from '~/updates/addon-updates';
import { automaticUpdates } from '~/updates/addon-updates';
import { useUnboundSettings } from '~/settings/unbound';
import type { UpdatesState } from '~/updates/state';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';
import UpdatesStore from '~/updates/state';
import Page from '~/ui/components/page';
import { icons } from '~/assets/api';

import { fromNow, headline, kindIcon } from './format';
import LoaderUpdateRow from './loader-update-row';
import UpdateButton from './update-button';
import Changelog from './changelog';

type UpdateRowProps = {
	entry: PendingUpdate;
};

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

/** A pending update: the version jump and what changed most recently; pressing it opens the changelog. */
function UpdateRow({ entry }: UpdateRowProps) {
	const navigation = Discord.useNavigation();
	const { update } = entry;
	const summary = headline(update.changelogs[0]?.changelog ?? update.changelog);
	const held = Manager.for(entry.kind).getHeldVersion(entry.id);
	const versions = `${entry.from} → ${update.version}`;
	const jump = held
		? `${versions} · ${format('UNBOUND_UPDATES_HELD', { version: held })}`
		: versions;

	return (
		<Discord.TableRow
			label={entry.name}
			subLabel={summary ? `${jump}\n${summary}` : jump}
			labelLineClamp={1}
			subLabelLineClamp={2}
			icon={<Discord.TableRowIcon source={kindIcon(entry.kind)} />}
			trailing={<UpdateButton id={entry.id} text={messages.UNBOUND_UPDATE} />}
			onPress={() =>
				navigation.push(Screens.Custom, {
					title: entry.name,
					render: () => (
						<Changelog
							name={entry.name}
							icon={kindIcon(entry.kind)}
							installed={entry.from}
							offered={update.version}
							changelogs={update.changelogs}
						>
							<UpdateButton
								id={entry.id}
								size='lg'
								grow
								text={format('UNBOUND_UPDATES_UPDATE_TO', {
									version: update.version,
								})}
								onUpdated={() => navigation.goBack()}
							/>
						</Changelog>
					),
				})
			}
		/>
	);
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
