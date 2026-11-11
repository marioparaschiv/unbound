//! A form's values as the argv `ubd` parses, and the launcher that runs it.

use std::collections::HashMap;
use std::path::PathBuf;

use super::catalog::{CommandSpec, Field, FieldKind};

/// What a form holds for one field.
#[derive(Clone, Debug, PartialEq)]
pub enum FieldValue {
	Text(String),
	Bool(bool),
}

#[derive(Debug, PartialEq, thiserror::Error)]
pub enum ArgError {
	#[error("{0} is required")]
	Missing(String),
	#[error("{0} takes a number")]
	NotANumber(String),
	#[error("{0} takes a whole number")]
	NotAnInteger(String),
	#[error("{0} takes one of {1}")]
	NotAChoice(String, String),
	#[error("Fill in {0} before {1}")]
	PositionalGap(String, String),
}

/// A list field's text: one item per comma or line.
pub fn list_items(text: &str) -> Vec<String> {
	text.split([',', '\n'])
		.map(str::trim)
		.filter(|item| !item.is_empty())
		.map(str::to_owned)
		.collect()
}

fn text_of<'a>(values: &'a HashMap<String, FieldValue>, field: &Field) -> &'a str {
	match values.get(&field.name) {
		Some(FieldValue::Text(text)) => text.trim(),
		_ => "",
	}
}

fn check(field: &Field, text: &str) -> Result<(), ArgError> {
	match &field.kind {
		FieldKind::Number if text.parse::<f64>().is_err() => {
			Err(ArgError::NotANumber(field.name.clone()))
		}
		FieldKind::Integer if text.parse::<i64>().is_err() => {
			Err(ArgError::NotAnInteger(field.name.clone()))
		}
		FieldKind::Choice(choices) if !choices.iter().any(|choice| choice == text) => {
			Err(ArgError::NotAChoice(field.name.clone(), choices.join(", ")))
		}
		_ => Ok(()),
	}
}

/// The arguments after the command's path: flags first, then positionals in order. A value equal
/// to its default is left out, so the line reads like one a person would type.
pub fn arguments(
	spec: &CommandSpec,
	values: &HashMap<String, FieldValue>,
) -> Result<Vec<String>, ArgError> {
	let mut args = Vec::new();
	for field in spec.fields.iter().filter(|field| !field.positional) {
		if field.kind == FieldKind::Bool {
			let on = match values.get(&field.name) {
				Some(FieldValue::Bool(on)) => *on,
				_ => field.default_bool(),
			};
			if on != field.default_bool() {
				let flag = field.flag();
				args.push(if on {
					flag
				} else {
					format!("--no-{}", &flag[2..])
				});
			}
			continue;
		}
		let text = text_of(values, field);
		if text.is_empty() || text == field.default_text() {
			if field.required && text.is_empty() {
				return Err(ArgError::Missing(field.name.clone()));
			}
			continue;
		}
		if field.kind == FieldKind::List {
			for item in list_items(text) {
				args.push(format!("{}={item}", field.flag()));
			}
			continue;
		}
		check(field, text)?;
		args.push(format!("{}={text}", field.flag()));
	}

	let positionals: Vec<&Field> = spec
		.positionals
		.iter()
		.filter_map(|name| spec.fields.iter().find(|field| &field.name == name))
		.collect();
	let filled = positionals
		.iter()
		.rposition(|field| !text_of(values, field).is_empty());
	for (ix, field) in positionals.iter().enumerate() {
		let text = text_of(values, field);
		if filled.is_none_or(|last| ix > last) {
			if field.required {
				return Err(ArgError::Missing(field.name.clone()));
			}
			continue;
		}
		if field.kind == FieldKind::List {
			args.extend(list_items(text));
			continue;
		}
		let text = if text.is_empty() {
			let default = field.default_text();
			if default.is_empty() {
				let next = positionals[ix + 1..]
					.iter()
					.find(|later| !text_of(values, later).is_empty())
					.map_or_else(String::new, |later| later.name.clone());
				return Err(ArgError::PositionalGap(field.name.clone(), next));
			}
			default
		} else {
			text.to_owned()
		};
		check(field, &text)?;
		args.push(text);
	}
	Ok(args)
}

/// The program that runs `ubd`, such as `ubd` or `bunx @unbound-app/cli`, split like a shell
/// would split it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Launcher {
	pub program: String,
	pub prefix: Vec<String>,
}

impl Launcher {
	pub fn parse(line: &str) -> Option<Self> {
		let mut words = split_words(line).into_iter();
		Some(Self {
			program: words.next()?,
			prefix: words.collect(),
		})
	}

	/// Like [`Launcher::parse`], except a bare `ubd` runs the CLI shipped beside this app when
	/// there is one, so its commands match this build and it needs no Bun.
	pub fn resolve(line: &str) -> Option<Self> {
		let mut launcher = Self::parse(line)?;
		if launcher.program == "ubd"
			&& let Some(path) = bundled_cli()
		{
			launcher.program = path.to_string_lossy().into_owned();
		}
		Some(launcher)
	}

	/// The whole argv after the program: the launcher's own words, then `args`.
	pub fn argv(&self, args: &[String]) -> Vec<String> {
		self.prefix.iter().chain(args).cloned().collect()
	}

	/// The line a person would paste into a shell to run the same thing.
	pub fn display(&self, args: &[String]) -> String {
		std::iter::once(&self.program)
			.chain(&self.prefix)
			.chain(args)
			.map(|word| quote(word))
			.collect::<Vec<_>>()
			.join(" ")
	}
}

/// The `ubd` release builds ship next to this app's executable, if this build has one.
pub fn bundled_cli() -> Option<PathBuf> {
	let path = std::env::current_exe()
		.ok()?
		.with_file_name(format!("ubd{}", std::env::consts::EXE_SUFFIX));
	path.is_file().then_some(path)
}

fn split_words(line: &str) -> Vec<String> {
	let mut words = Vec::new();
	let mut word = String::new();
	let mut quote = None;
	let mut started = false;
	for ch in line.chars() {
		match (quote, ch) {
			(Some(open), ch) if ch == open => quote = None,
			(Some(_), ch) => word.push(ch),
			(None, '"' | '\'') => {
				quote = Some(ch);
				started = true;
			}
			(None, ch) if ch.is_whitespace() => {
				if started {
					words.push(std::mem::take(&mut word));
					started = false;
				}
			}
			(None, ch) => {
				word.push(ch);
				started = true;
			}
		}
	}
	if started {
		words.push(word);
	}
	words
}

fn quote(word: &str) -> String {
	let plain = !word.is_empty()
		&& word
			.chars()
			.all(|ch| ch.is_ascii_alphanumeric() || "-_./:=@,+%".contains(ch));
	if plain {
		word.to_owned()
	} else {
		format!("'{}'", word.replace('\'', r"'\''"))
	}
}
