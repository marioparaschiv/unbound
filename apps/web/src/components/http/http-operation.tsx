import {
	getParameterField,
	getSchemaFields,
	type HttpOperationEntry,
	type SchemaField,
} from '~/lib/docs/http-reference';
import SchemaFields from '~/components/http/schema-fields';
import MethodBadge from '~/components/http/method-badge';
import Heading from '~/components/guides/heading';
import Prose from '~/components/http/prose';
import Text from '~/components/ui/text';

type HttpOperationProps = {
	entry: HttpOperationEntry;
};

type FieldGroupProps = {
	title: string;
	fields: SchemaField[];
};

function FieldGroup({ title, fields }: FieldGroupProps) {
	if (!fields.length) return null;

	return (
		<div className='flex flex-col gap-3'>
			<Text
				as='h3'
				variant='text-xs'
				color='muted'
				className='font-semibold uppercase tracking-wide'
			>
				{title}
			</Text>
			<SchemaFields fields={fields} />
		</div>
	);
}

/**
 * @description One operation's section of the HTTP reference: its method and path, prose, parameters,
 * request body and response.
 * @param props The operation.
 * @returns The section.
 */
function HttpOperation({ entry }: HttpOperationProps) {
	const { operation } = entry;
	const parameters = operation.parameters ?? [];
	const body = operation.requestBody?.content['application/json'].schema;
	const response = operation.responses['200'].content['application/json'].schema;

	return (
		<section className='flex flex-col gap-5 pt-2 border-t'>
			<div className='flex flex-col gap-3'>
				<Heading level='h3' id={entry.anchor}>
					{operation.summary}
				</Heading>
				<p className='flex flex-wrap items-center gap-2 font-mono text-sm break-all'>
					<MethodBadge method={entry.method} />
					{entry.path}
				</p>
				<Prose text={operation.description} />
			</div>
			<FieldGroup
				title='Path parameters'
				fields={parameters.filter((entry) => entry.in === 'path').map(getParameterField)}
			/>
			<FieldGroup
				title='Query parameters'
				fields={parameters.filter((entry) => entry.in === 'query').map(getParameterField)}
			/>
			<FieldGroup title='Request body' fields={body ? getSchemaFields(body) : []} />
			<FieldGroup title='Response' fields={getSchemaFields(response)} />
		</section>
	);
}

export default HttpOperation;
