import { fetchAddonVersions, toVersionChoices } from '~/addons/versions';
import type { UpdatableKind } from '~/addons/manager-of';
import type { AvailableChoice } from '~/addons/versions';
import { CLIENT_VERSION } from '~/core/constants';
import { BottomSheets } from '~/metro/components';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';

import useResource from './use-resource';
import VersionRow from './version-row';

type VersionPickerSheetProps = {
	kind: UpdatableKind;
	id: string;
	name: string;
	/** Runs with the chosen version; the sheet is already closing. */
	onPick: (choice: AvailableChoice) => void;
	onClose: () => void;
};

/**
 * @description An action sheet listing every live version of a listed addon, newest first. Pressing a
 * version this client can run, other than the installed one, closes the sheet and hands it back.
 */
function VersionPickerSheet({ kind, id, name, onPick, onClose }: VersionPickerSheetProps) {
	const { ActionSheet, ActionSheetRow, BottomSheetTitleHeader } = BottomSheets;
	const { state, retry } = useResource(id, fetchAddonVersions);
	const held = Manager.for(kind).getHeldVersion(id);
	const installed = Manager.for(kind).getAddon(id)?.version;

	function pick(choice: AvailableChoice) {
		onClose();
		onPick(choice);
	}

	return (
		<ActionSheet>
			<BottomSheetTitleHeader
				title={format('UNBOUND_VERSIONS_TITLE', { name })}
				subtitle={held ? format('UNBOUND_VERSIONS_HELD', { version: held }) : void 0}
			/>
			<ActionSheetRow.Group>
				{state.status === 'loading' ? (
					<ActionSheetRow label={messages.UNBOUND_VERSIONS_LOADING} disabled />
				) : null}
				{state.status === 'failed' ? (
					<ActionSheetRow
						label={messages.UNBOUND_VERSIONS_FAILED}
						subLabel={messages.UNBOUND_VERSIONS_RETRY}
						onPress={retry}
					/>
				) : null}
				{state.status === 'ready'
					? toVersionChoices(state.value, installed, CLIENT_VERSION).map((choice) => (
							<VersionRow
								key={choice.version.version}
								choice={choice}
								onPick={pick}
							/>
						))
					: null}
			</ActionSheetRow.Group>
		</ActionSheet>
	);
}

export default VersionPickerSheet;
