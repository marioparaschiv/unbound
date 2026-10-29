import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '~/components/ui/select';
import type { ManifestSummary } from '~/lib/admin-addon';
import Textarea from '~/components/ui/textarea';
import Input from '~/components/ui/input';

import type { SettingsForm } from './use-settings-form';

import ManifestField from './manifest-field';
import { TYPE_LABELS } from './changes';

type ListingFieldsProps = {
	form: SettingsForm;
	manifest: ManifestSummary | null;
	disabled: boolean;
};

function ListingFields({ form, manifest, disabled }: ListingFieldsProps) {
	return (
		<div className='flex flex-col gap-6'>
			<div className='gap-6 grid sm:grid-cols-[2fr_1fr]'>
				<form.Field name='name'>
					{(field) => (
						<ManifestField
							id='b-edit-name'
							label='Name'
							overridden={field.state.value !== null}
							manifestText={manifest ? manifest.name : null}
							onReset={() => field.handleChange(null)}
							disabled={disabled}
							errors={field.state.meta.errors}
						>
							<Input
								id='b-edit-name'
								value={field.state.value ?? manifest?.name ?? ''}
								onChange={(event) => field.handleChange(event.target.value)}
								onBlur={field.handleBlur}
								disabled={disabled}
								aria-invalid={field.state.meta.errors.length > 0}
							/>
						</ManifestField>
					)}
				</form.Field>

				<form.Field name='type'>
					{(field) => (
						<ManifestField
							id='b-edit-type'
							label='Type'
							overridden={field.state.value !== null}
							manifestText={manifest ? TYPE_LABELS[manifest.type] : null}
							onReset={() => field.handleChange(null)}
							disabled={disabled}
							errors={field.state.meta.errors}
						>
							<Select
								items={TYPE_LABELS}
								value={field.state.value ?? manifest?.type ?? null}
								onValueChange={(type) => field.handleChange(type)}
								disabled={disabled}
							>
								<SelectTrigger
									id='b-edit-type'
									className='w-full'
									onBlur={field.handleBlur}
									aria-invalid={field.state.meta.errors.length > 0}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(TYPE_LABELS).map(([type, label]) => (
										<SelectItem key={type} value={type}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</ManifestField>
					)}
				</form.Field>
			</div>

			<form.Field name='description'>
				{(field) => (
					<ManifestField
						id='b-edit-description'
						label='Description'
						overridden={field.state.value !== null}
						manifestText={manifest ? manifest.description : null}
						onReset={() => field.handleChange(null)}
						disabled={disabled}
						errors={field.state.meta.errors}
					>
						<Textarea
							id='b-edit-description'
							value={field.state.value ?? manifest?.description ?? ''}
							onChange={(event) => field.handleChange(event.target.value)}
							onBlur={field.handleBlur}
							disabled={disabled}
							aria-invalid={field.state.meta.errors.length > 0}
						/>
					</ManifestField>
				)}
			</form.Field>
		</div>
	);
}

export default ListingFields;
