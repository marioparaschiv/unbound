//! TypeScript to the JavaScript the device evaluates: oxc strips the types, then top-level `let`
//! and `const` become `var`, because an indirect `eval` drops lexical bindings when it returns and
//! the next entry would not see them.

use std::path::Path;

use oxc::allocator::Allocator;
use oxc::ast::ast::{Statement, VariableDeclarationKind};
use oxc::codegen::Codegen;
use oxc::parser::Parser;
use oxc::semantic::SemanticBuilder;
use oxc::span::SourceType;
use oxc::transformer::{TransformOptions, Transformer};

use crate::top_level_await;

/// The entry as JavaScript, or the first syntax error's message.
pub fn transpile(source: &str) -> Result<String, String> {
	let allocator = Allocator::default();
	let parsed = Parser::new(&allocator, source, SourceType::ts()).parse();
	if let Some(error) = parsed.diagnostics.errors().next() {
		return Err(error.to_string());
	}
	let mut program = parsed.program;
	let scoping = SemanticBuilder::new()
		.build(&program)
		.semantic
		.into_scoping();
	let transformed = Transformer::new(
		&allocator,
		Path::new("console.ts"),
		&TransformOptions::default(),
	)
	.build_with_scoping(scoping, &mut program);
	if let Some(error) = transformed.diagnostics.errors().next() {
		return Err(error.to_string());
	}
	for statement in program.body.iter_mut() {
		if let Statement::VariableDeclaration(declaration) = statement {
			declaration.kind = VariableDeclarationKind::Var;
		}
	}

	let js = Codegen::new().build(&program).code;

	Ok(top_level_await::wrap(&js).unwrap_or(js))
}

#[cfg(test)]
mod tests {
	use super::transpile;

	#[test]
	fn strips_types_and_keeps_top_level_bindings() {
		let js =
			transpile("const user: { id: string } = { id: '1' };\nlet n = user.id as string;\nn")
				.unwrap();
		assert!(js.contains("var user = { id: \"1\" }"), "{js}");
		assert!(js.contains("var n = user.id;"), "{js}");
		assert!(!js.contains(": {"), "{js}");
	}

	#[test]
	fn keeps_nested_bindings_lexical() {
		let js = transpile("function f() { const x = 1; return x; }").unwrap();
		assert!(js.contains("const x = 1"), "{js}");
	}

	#[test]
	fn runs_top_level_await_in_an_async_arrow() {
		let js = transpile("const user: { id: string } = await load();\nuser.id").unwrap();
		assert!(js.starts_with("var user;\n(async () => {"), "{js}");
		assert!(js.contains("return (user.id);"), "{js}");
	}

	#[test]
	fn reports_syntax_errors() {
		assert!(transpile("const = 1").is_err());
	}
}
