import type { SchemaField } from '~/lib/docs/http-reference';
import Expandable from '~/components/guides/expandable';
import { ParamField } from '~/components/guides/field';
import Prose from '~/components/http/prose';

type SchemaFieldsProps = {
	fields: SchemaField[];
};

type SchemaFieldEntryProps = {
	field: SchemaField;
};

function SchemaFieldEntry({ field }: SchemaFieldEntryProps) {
	const hasDetails =
		Boolean(field.description) || field.constraints.length > 0 || field.fields.length > 0;

	return (
		<ParamField
			path={field.name}
			type={field.type}
			required={field.required}
			default={field.default}
		>
			{hasDetails ? (
				<>
					{field.description ? <Prose text={field.description} className='' /> : null}
					{field.constraints.length ? (
						<ul className='flex flex-wrap gap-1.5'>
							{field.constraints.map((constraint) => (
								<li
									key={constraint}
									className='bg-muted px-1.5 py-0.5 rounded-[4px] font-mono text-xs break-all'
								>
									{constraint}
								</li>
							))}
						</ul>
					) : null}
					{field.fields.length ? (
						<Expandable title='properties'>
							<SchemaFields fields={field.fields} />
						</Expandable>
					) : null}
				</>
			) : null}
		</ParamField>
	);
}

/**
 * @description A body's or parameter list's fields in the guides' field style, each object's keys
 * collapsed under it.
 * @param props The fields.
 * @returns The list.
 */
function SchemaFields({ fields }: SchemaFieldsProps) {
	return (
		<div className='flex flex-col'>
			{fields.map((field) => (
				<SchemaFieldEntry key={field.name} field={field} />
			))}
		</div>
	);
}

export default SchemaFields;
