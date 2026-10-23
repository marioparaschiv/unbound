import useAddonSettingsForm from '~/components/admin/addon-settings/use-addon-settings-form';
import MaintainersPanel from '~/components/admin/addon-settings/maintainers-panel';
import VisibilityPanel from '~/components/admin/addon-settings/visibility-panel';
import ListingPanel from '~/components/admin/addon-settings/listing-panel';
import SourcePanel from '~/components/admin/addon-settings/source-panel';
import SavePanel from '~/components/admin/addon-settings/save-panel';
import type { AdminAddonView } from '~/lib/admin-addon';

type AddonSettingsFormProps = {
	view: AdminAddonView;
};

function AddonSettingsForm({ view }: AddonSettingsFormProps) {
	const form = useAddonSettingsForm(view);

	return (
		<form
			className='flex flex-col gap-4'
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<ListingPanel form={form} manifest={view.manifest} />
			<SourcePanel form={form} />
			<VisibilityPanel form={form} />
			<MaintainersPanel form={form} maintainers={view.maintainers} />
			<SavePanel form={form} />
		</form>
	);
}

export default AddonSettingsForm;
