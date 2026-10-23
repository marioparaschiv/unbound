import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useState } from 'react';

import type { AddonSettingsForm } from '~/components/admin/addon-settings/use-addon-settings-form';
import SettingsPanel from '~/components/admin/addon-settings/settings-panel';
import { Field, FieldError, FieldLabel } from '~/components/ui/field';
import MaintainerEditor from '~/components/admin/maintainer-editor';
import type { AdminAddonView } from '~/lib/admin-addon';

type MaintainersPanelProps = {
	form: AddonSettingsForm;
	/** The current maintainers, which seed the names and avatars the editor knows. */
	maintainers: AdminAddonView['maintainers'];
};

function MaintainersPanel({ form, maintainers }: MaintainersPanelProps) {
	const [users, setUsers] = useState(() =>
		Object.fromEntries(maintainers.map(({ id, name, image }) => [id, { id, name, image }])),
	);

	function pick(user: UserSummary) {
		setUsers((current) => ({ ...current, [user.id]: user }));
	}

	return (
		<SettingsPanel
			title='Maintainers'
			description='Maintainers can submit updates. Owners can also add and remove maintainers.'
			hint='Every addon needs at least one owner.'
		>
			<form.Field name='maintainers'>
				{(field) => (
					<Field data-invalid={field.state.meta.errors.length > 0}>
						<FieldLabel htmlFor='edit-maintainers' className='sr-only'>
							Add a maintainer
						</FieldLabel>
						<MaintainerEditor
							id='edit-maintainers'
							members={field.state.value}
							users={users}
							onChange={(members: MaintainerEntry[]) => field.handleChange(members)}
							onPick={pick}
						/>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
		</SettingsPanel>
	);
}

export default MaintainersPanel;
