import type { AddonSettingsForm } from '~/components/admin/addon-settings/use-addon-settings-form';
import { Field, FieldDescription, FieldError, FieldLabel } from '~/components/ui/field';
import SettingsPanel from '~/components/admin/addon-settings/settings-panel';
import Input from '~/components/ui/input';

type SourcePanelProps = {
	form: AddonSettingsForm;
};

function SourcePanel({ form }: SourcePanelProps) {
	return (
		<SettingsPanel title='Source' description='Where the addon’s code lives.'>
			<form.Field name='repository'>
				{(field) => (
					<Field data-invalid={field.state.meta.errors.length > 0}>
						<FieldLabel htmlFor='edit-repository'>Repository</FieldLabel>
						<Input
							id='edit-repository'
							placeholder='owner/name'
							value={field.state.value ?? ''}
							onChange={(event) =>
								field.handleChange(event.target.value.trim() || null)
							}
							onBlur={field.handleBlur}
							aria-invalid={field.state.meta.errors.length > 0}
						/>
						<FieldDescription>
							The GitHub repository the addon is built from.
						</FieldDescription>
						<FieldError errors={field.state.meta.errors} />
					</Field>
				)}
			</form.Field>
		</SettingsPanel>
	);
}

export default SourcePanel;
