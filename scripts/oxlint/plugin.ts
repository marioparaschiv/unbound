// Node strips the types when oxlint loads this plugin, so every import names its `.ts` file.
import preferDiscriminatedUnion from './rules/prefer-discriminated-union.ts';
import noAssertedExternalData from './rules/no-asserted-external-data.ts';
import noImportOutsidePackage from './rules/no-import-outside-package.ts';
import noPassThroughWrapper from './rules/no-pass-through-wrapper.ts';
import noUpwardImports from './rules/no-upward-imports.ts';
import noEnvMutation from './rules/no-env-mutation.ts';
import maxFileBytes from './rules/max-file-bytes.ts';

export default {
	meta: { name: 'unbound' },
	rules: {
		'prefer-discriminated-union': preferDiscriminatedUnion,
		'no-import-outside-package': noImportOutsidePackage,
		'no-asserted-external-data': noAssertedExternalData,
		'no-pass-through-wrapper': noPassThroughWrapper,
		'no-upward-imports': noUpwardImports,
		'no-env-mutation': noEnvMutation,
		'max-file-bytes': maxFileBytes,
	},
};
