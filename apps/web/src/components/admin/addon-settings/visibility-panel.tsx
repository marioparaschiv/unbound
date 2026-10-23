import type { AddonSettingsForm } from '~/components/admin/addon-settings/use-addon-settings-form';
import { Field, FieldContent, FieldDescription, FieldLabel } from '~/components/ui/field';
import SettingsPanel from '~/components/admin/addon-settings/settings-panel';
import Switch from '~/components/ui/switch';

type VisibilityPanelProps = {
	form: AddonSettingsForm;
};

function VisibilityPanel({ form }: VisibilityPanelProps) {
	return (
		<SettingsPanel title='Visibility' description='Who can find and install the addon.'>
			<form.Field name='delisted'>
				{(field) => (
					<Field orientation='horizontal' className='justify-between gap-6'>
						<FieldContent>
							<FieldLabel htmlFor='edit-delisted'>Delisted</FieldLabel>
							<FieldDescription id='edit-delisted-description'>
								Hidden from listings, the catalog and update checks.
							</FieldDescription>
						</FieldContent>
						<Switch
							id='edit-delisted'
							aria-describedby='edit-delisted-description'
							checked={field.state.value}
							onCheckedChange={(checked) => field.handleChange(checked)}
						/>
					</Field>
				)}
			</form.Field>
		</SettingsPanel>
	);
}

export default VisibilityPanel;
