import { useState } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { format } from '~/api/i18n';

type InstallUrlModalProps = {
	kind: ManagerKind;
	onClose: () => void;
};

/**
 * @description A modal that takes a manifest URL and installs it through the kind's manager. On success
 * the list updates via its own subscription; failures surface through the manager's `install-error`.
 */
function InstallUrlModal({ kind, onClose }: InstallUrlModalProps) {
	const [url, setUrl] = useState('');
	const [busy, setBusy] = useState(false);
	const manager = getManager(kind);

	function install() {
		if (!url || busy) return;
		setBusy(true);

		Promise.resolve(manager.install(url)).finally(() => {
			setBusy(false);
			onClose();
		});
	}

	return (
		<Discord.AlertModal
			title={format('UNBOUND_INSTALL')}
			content={format('UNBOUND_INSTALL_URL_HINT')}
			extraContent={
				<Discord.TextField
					value={url}
					placeholder='https://…'
					autoFocus
					onChange={setUrl}
				/>
			}
			actions={
				<>
					<Discord.AlertActionButton
						text={format('UNBOUND_INSTALL')}
						variant='primary'
						loading={busy}
						onPress={install}
					/>
					<Discord.AlertActionButton
						text={format('UNBOUND_CANCEL')}
						variant='secondary'
						onPress={onClose}
					/>
				</>
			}
		/>
	);
}

export default InstallUrlModal;
