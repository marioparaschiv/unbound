import { editAddonRequestSchema } from '@unbound-app/contracts/admin';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';

import { editAddonMutation } from '~/queries/admin-addons/addon-mutations';
import getApiErrorMessage from '~/lib/api/error-message';
import type { AdminAddonView } from '~/lib/admin-addon';

/**
 * @description Creates the addon settings form, which saves through `editAddonMutation` and refreshes the addon's pages.
 * @param view The admin view of the addon; its `form` is the initial value.
 * @returns The form, passed whole to each settings panel.
 */
function useAddonSettingsForm(view: AdminAddonView) {
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
			// The tab title comes from loader data, so rerun this page's loader; it reads the refreshed cache.
			void router.invalidate({
				filter: (match) => match.routeId === '/_site/_staff/admin/addons/$id',
			});
		},
	});
}

export type AddonSettingsForm = ReturnType<typeof useAddonSettingsForm>;

export default useAddonSettingsForm;
