// Node strips the types when oxlint loads this plugin, so every import names its `.ts` file.
import platformCheckOnlyInPlatformFile from './rules/platform-check-only-in-platform-file.ts';
import preferDiscriminatedUnion from './rules/prefer-discriminated-union.ts';
import noAssertedExternalData from './rules/no-asserted-external-data.ts';
import noImportOutsidePackage from './rules/no-import-outside-package.ts';
import noPassThroughWrapper from './rules/no-pass-through-wrapper.ts';
import noModuleScopeLookup from './rules/no-module-scope-lookup.ts';
import noUpwardImports from './rules/no-upward-imports.ts';
import noWindowUnbound from './rules/no-window-unbound.ts';
import noEnvMutation from './rules/no-env-mutation.ts';
import maxFileBytes from './rules/max-file-bytes.ts';

export default {
	meta: { name: 'unbound' },
	rules: {
		'platform-check-only-in-platform-file': platformCheckOnlyInPlatformFile,
		'prefer-discriminated-union': preferDiscriminatedUnion,
		'no-module-scope-lookup': noModuleScopeLookup,
		'no-window-unbound': noWindowUnbound,
		'no-import-outside-package': noImportOutsidePackage,
		'no-asserted-external-data': noAssertedExternalData,
		'no-pass-through-wrapper': noPassThroughWrapper,
		'no-upward-imports': noUpwardImports,
		'no-env-mutation': noEnvMutation,
		'max-file-bytes': maxFileBytes,
	},
};
