import { editAddonRequestSchema } from '@unbound-app/contracts/admin';
import { useRouter } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';

import getApiErrorMessage from '~/lib/api/error-message';
import { submitAddonEdit } from '~/lib/admin-functions';
import type { AdminAddonView } from '~/lib/admin-addon';

/**
 * @description Creates the addon settings form, which saves through `submitAddonEdit` and reloads the page's data.
 * @param view The admin view of the addon; its `form` is the initial value.
 * @returns The form, passed whole to each settings panel.
 */
function useAddonSettingsForm(view: AdminAddonView) {
	const router = useRouter();
	const addonId = view.addon.id;

	return useForm({
		defaultValues: view.form,
		validators: { onChange: editAddonRequestSchema },
		onSubmit: async ({ value }) => {
			try {
				await submitAddonEdit({ data: { id: addonId, edit: value } });
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			toast.success(`Saved ${addonId}`);
			await router.invalidate();
		},
	});
}

export type AddonSettingsForm = ReturnType<typeof useAddonSettingsForm>;

export default useAddonSettingsForm;
