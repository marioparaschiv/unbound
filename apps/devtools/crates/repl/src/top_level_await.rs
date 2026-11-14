//! Top-level `await` for an entry the device runs through an indirect `eval`, which only takes a
//! script. An entry that awaits at its top level runs inside an async arrow instead: its bindings
//! become globals declared before the arrow and assigned inside it, so later entries still see
//! them, and its last expression becomes the arrow's result, which the helper awaits.

use oxc::allocator::Allocator;
use oxc::ast::ast::{
	ArrowFunctionExpression, AwaitExpression, Class, ForOfStatement, Function, Statement,
};
use oxc::ast_visit::{Visit, walk};
use oxc::parser::Parser;
use oxc::span::{GetSpan, SourceType};
use oxc::syntax::scope::ScopeFlags;

/// Whether a program awaits outside every function.
#[derive(Default)]
struct FindsAwait(bool);

impl<'a> Visit<'a> for FindsAwait {
	fn visit_await_expression(&mut self, _: &AwaitExpression<'a>) {
		self.0 = true;
	}

	fn visit_for_of_statement(&mut self, it: &ForOfStatement<'a>) {
		self.0 |= it.r#await;
		walk::walk_for_of_statement(self, it);
	}

	// An `await` in a function or class belongs to it, not to the entry.
	fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}

	fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}

	fn visit_class(&mut self, _: &Class<'a>) {}
}

/// `js` run inside an async arrow, or `None` when it awaits nothing at its top level.
pub fn wrap(js: &str) -> Option<String> {
	let allocator = Allocator::default();
	let parsed = Parser::new(&allocator, js, SourceType::mjs()).parse();
	if parsed.diagnostics.errors().next().is_some() {
		return None;
	}
	let program = parsed.program;
	let mut finds = FindsAwait::default();
	finds.visit_program(&program);
	if !finds.0 {
		return None;
	}

	let text = |span: oxc::span::Span| &js[span.start as usize..span.end as usize];
	let mut globals = Vec::new();
	let mut functions = String::new();
	let mut body = String::new();
	let last = program.body.len().saturating_sub(1);
	for (index, statement) in program.body.iter().enumerate() {
		match statement {
			Statement::VariableDeclaration(declaration) => {
				for declarator in &declaration.declarations {
					globals.extend(
						declarator
							.id
							.get_binding_identifiers()
							.into_iter()
							.map(|id| id.name.to_string()),
					);
					if let Some(init) = &declarator.init {
						body.push_str(&format!(
							"({} = {});\n",
							text(declarator.id.span()),
							text(init.span())
						));
					}
				}
			}
			// Declared before the arrow, so they stay global and hoisted as in a script.
			Statement::FunctionDeclaration(_) => {
				functions.push_str(text(statement.span()));
				functions.push('\n');
			}
			Statement::ClassDeclaration(class) => {
				let Some(id) = &class.id else {
					continue;
				};
				globals.push(id.name.to_string());
				body.push_str(&format!("{} = {};\n", id.name, text(class.span)));
			}
			Statement::ExpressionStatement(expression) if index == last => {
				body.push_str(&format!(
					"return ({});\n",
					text(expression.expression.span())
				));
			}
			_ => {
				body.push_str(text(statement.span()));
				body.push('\n');
			}
		}
	}
	let globals = if globals.is_empty() {
		String::new()
	} else {
		format!("var {};\n", globals.join(", "))
	};

	Some(format!("{globals}{functions}(async () => {{\n{body}}})()"))
}

#[cfg(test)]
mod tests {
	use super::wrap;

	#[test]
	fn leaves_an_entry_without_await() {
		assert_eq!(wrap("var a = 1;\na + 1;"), None);
		assert_eq!(wrap("async function f() { await 1; }"), None);
	}

	#[test]
	fn keeps_bindings_global_and_returns_the_last_expression() {
		let js = wrap("var { id, name: n } = await load();\nfunction f() {}\nid + n;").unwrap();
		assert_eq!(
			js,
			"var id, n;\nfunction f() {}\n(async () => {\n({ id, name: n } = await load());\nreturn (id + n);\n})()"
		);
	}

	#[test]
	fn treats_for_await_as_top_level_await() {
		let js = wrap("for await (const x of xs) log(x);").unwrap();
		assert!(js.starts_with("(async () => {\nfor await"), "{js}");
	}
}
