import { editAddonRequestSchema } from '@unbound-app/contracts/admin';
import type { EditAddonRequest } from '@unbound-app/contracts/admin';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';

import { editAddonMutation } from '~/queries/admin-addons/addon-mutations';
import getApiErrorMessage from '~/lib/api/error-message';
import type { AdminAddonView } from '~/lib/admin-addon';

/** The form fields a save pill counts, each named the way the pill says it. */
export const CHANGE_LABELS = {
	icon: 'Icon',
	name: 'Name',
	description: 'Description',
	type: 'Type',
	repository: 'Source',
	delisted: 'Visibility',
	maintainers: 'Maintainers',
} as const;

export type ChangeKey = keyof typeof CHANGE_LABELS;

const CHANGE_KEYS = Object.keys(CHANGE_LABELS).filter(
	(key): key is ChangeKey => key in CHANGE_LABELS,
);

/**
 * @description Lists the fields whose values differ from what the form loaded.
 * @param initial The loaded values.
 * @param current The current values.
 * @returns The changed fields, in display order.
 */
export function changedKeys(initial: EditAddonRequest, current: EditAddonRequest): ChangeKey[] {
	return CHANGE_KEYS.filter(
		(key) => JSON.stringify(initial[key]) !== JSON.stringify(current[key]),
	);
}

/**
 * @description The addon settings form, saved through `editAddonMutation`; refreshes the lab addon page.
 * @param view The admin view of the addon; its `form` is the initial value.
 * @returns The form.
 */
function useSettingsForm(view: AdminAddonView) {
	const addonId = view.addon.id;
	const edit = useMutation(editAddonMutation());
	const router = useRouter();

	return useForm({
		defaultValues: view.form,
		validators: { onChange: editAddonRequestSchema },
		onSubmit: async ({ value }) => {
			try {
				await edit.mutateAsync({ id: addonId, edit: value });
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			toast.success(`Saved ${addonId}`);
			void router.invalidate({
				filter: (match) => match.routeId === '/_site/_staff/lab/$variant/addons/$id',
			});
		},
	});
}

export type SettingsForm = ReturnType<typeof useSettingsForm>;

export default useSettingsForm;
