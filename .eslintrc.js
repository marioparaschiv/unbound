
/** @type { import('eslint').Linter.Config } */
const config = {
	env: {
		node: true,
		es2021: true,

	},
	extends: 'plugin:react/recommended',
	parser: '@typescript-eslint/parser',
	parserOptions: {
		'ecmaVersion': 'latest',
		'sourceType': 'module'
	},
	plugins: [
		'@typescript-eslint',
		'react'
	],
	rules: {
		quotes: [
			'error',
			'single'
		],
		'jsx-quotes': [
			'error',
			'prefer-single'
		],
		semi: [
			'error',
			'always'
		],
		'react/react-in-jsx-scope': 'off',
		'react/display-name': 'off',
		'react/prop-types': 'off'
	}
};

module.exports = config;