import type { MaintainerEntry } from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import MaintainerEditor from '~/components/admin/maintainer-editor';
import type { AdminAddonView } from '~/lib/admin-addon';
import { FieldError } from '~/components/ui/field';

import type { SettingsForm } from './use-settings-form';

type MaintainersCardProps = {
	form: SettingsForm;
	/** The saved maintainers, which seed the names and avatars the editor knows. */
	maintainers: AdminAddonView['maintainers'];
};

function MaintainersCard({ form, maintainers }: MaintainersCardProps) {
	const [users, setUsers] = useState(() =>
		Object.fromEntries(maintainers.map(({ id, name, image }) => [id, { id, name, image }])),
	);

	function pick(user: UserSummary) {
		setUsers((current) => ({ ...current, [user.id]: user }));
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Maintainers</CardTitle>
				<CardDescription>
					Maintainers can submit updates. Owners can also add and remove maintainers. Keep
					at least one owner.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form.Field name='maintainers'>
					{(field) => (
						<div className='flex flex-col gap-2'>
							<MaintainerEditor
								id='lab-a-maintainers'
								members={field.state.value}
								users={users}
								onChange={(members: MaintainerEntry[]) =>
									field.handleChange(members)
								}
								onPick={pick}
							/>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
			</CardContent>
		</Card>
	);
}

export default MaintainersCard;
