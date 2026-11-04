import type { ReactNode } from 'react';

import {
	getCurlExample,
	getParameterField,
	getSchemaFields,
	type HttpOperationEntry,
	type SchemaField,
} from '~/lib/docs/http-reference';
import SchemaFields from '~/components/http/schema-fields';
import MethodBadge from '~/components/http/method-badge';
import CodeBlock from '~/components/guides/code-block';
import Heading from '~/components/guides/heading';
import Prose from '~/components/http/prose';
import Text from '~/components/ui/text';

type HttpOperationProps = {
	entry: HttpOperationEntry;
	serverUrl: string;
};

type FieldGroupProps = {
	title: string;
	fields: SchemaField[];
	children?: ReactNode;
};

function FieldGroup({ title, fields, children }: FieldGroupProps) {
	if (!fields.length && !children) return null;

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
			{children}
			{fields.length ? <SchemaFields fields={fields} /> : null}
		</div>
	);
}

/**
 * @description One operation's section of the HTTP reference: its method and path, prose, parameters,
 * request body, response and a `curl` call.
 * @param props The operation and the origin it is served from.
 * @returns The section.
 */
function HttpOperation({ entry, serverUrl }: HttpOperationProps) {
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
			<FieldGroup title='Example' fields={[]}>
				<CodeBlock data-language='bash'>
					<code>{getCurlExample(serverUrl, entry)}</code>
				</CodeBlock>
			</FieldGroup>
		</section>
	);
}

export default HttpOperation;
