//! The commands `ubd catalog` describes, read into the shape a form needs.

use serde::Deserialize;
use serde_json::Value as Json;

/// The catalog format this build reads; `packages/cli/src/lib/catalog.ts` writes it.
pub const CATALOG_VERSION: u64 = 1;

/// What a field holds, which picks its control and how it becomes argv.
#[derive(Clone, Debug, PartialEq)]
pub enum FieldKind {
	Text,
	Integer,
	Number,
	Bool,
	/// One of fixed strings, from the schema's `enum` or a union of `const`s.
	Choice(Vec<String>),
	/// Strings, as a repeatable flag or a variadic positional.
	List,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Field {
	pub name: String,
	pub kind: FieldKind,
	pub description: Option<String>,
	pub default: Option<Json>,
	pub required: bool,
	pub positional: bool,
}

impl Field {
	/// The default as the text a form shows, `""` when there is none.
	pub fn default_text(&self) -> String {
		match &self.default {
			Some(Json::String(text)) => text.clone(),
			Some(Json::Number(number)) => number.to_string(),
			Some(Json::Array(items)) => items
				.iter()
				.filter_map(Json::as_str)
				.collect::<Vec<_>>()
				.join(", "),
			_ => String::new(),
		}
	}

	pub fn default_bool(&self) -> bool {
		self.default
			.as_ref()
			.and_then(Json::as_bool)
			.unwrap_or(false)
	}

	/// `--declared-capabilities` for `declaredCapabilities`, as cleye spells it.
	pub fn flag(&self) -> String {
		let mut flag = String::from("--");
		for ch in self.name.chars() {
			if ch.is_ascii_uppercase() {
				flag.push('-');
				flag.push(ch.to_ascii_lowercase());
			} else {
				flag.push(ch);
			}
		}
		flag
	}
}

#[derive(Clone, Debug, PartialEq)]
pub struct CommandSpec {
	pub name: String,
	pub description: String,
	pub summary: Option<String>,
	/// The words before the arguments: `["build"]`, or `["debug", "eval"]`.
	pub path: Vec<String>,
	/// The positional fields' names, in the order argv takes them.
	pub positionals: Vec<String>,
	pub fields: Vec<Field>,
}

impl CommandSpec {
	/// The summary, else the description's first sentence.
	pub fn headline(&self) -> String {
		if let Some(summary) = &self.summary {
			return summary.clone();
		}
		match self.description.find(". ") {
			Some(end) => self.description[..=end].to_string(),
			None => self.description.clone(),
		}
	}
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Catalog {
	pub commands: Vec<CommandSpec>,
}

#[derive(Debug, thiserror::Error)]
pub enum CatalogError {
	#[error("`ubd catalog` printed something that is not a catalog: {0}")]
	Malformed(#[from] serde_json::Error),
	#[error("`ubd catalog` is version {0}, and this build reads version {CATALOG_VERSION}")]
	Version(u64),
}

#[derive(Deserialize)]
struct RawCatalog {
	version: u64,
	commands: Vec<RawCommand>,
}

#[derive(Deserialize)]
struct RawCommand {
	name: String,
	description: String,
	summary: Option<String>,
	path: Vec<String>,
	#[serde(default)]
	positionals: Vec<String>,
	#[serde(default)]
	fields: Vec<RawField>,
}

#[derive(Deserialize)]
struct RawField {
	name: String,
	#[serde(default)]
	required: bool,
	schema: Json,
}

fn kind(schema: &Json) -> FieldKind {
	let strings = |values: &Json| -> Option<Vec<String>> {
		values
			.as_array()?
			.iter()
			.map(|value| value.as_str().map(str::to_owned))
			.collect()
	};
	if let Some(choices) = schema.get("enum").and_then(strings) {
		return FieldKind::Choice(choices);
	}
	let consts = schema
		.get("anyOf")
		.and_then(Json::as_array)
		.and_then(|variants| {
			variants
				.iter()
				.map(|variant| variant.get("const")?.as_str().map(str::to_owned))
				.collect::<Option<Vec<_>>>()
		});
	if let Some(choices) = consts.filter(|choices| !choices.is_empty()) {
		return FieldKind::Choice(choices);
	}
	match schema.get("type").and_then(Json::as_str) {
		Some("boolean") => FieldKind::Bool,
		Some("integer") => FieldKind::Integer,
		Some("number") => FieldKind::Number,
		Some("array") => FieldKind::List,
		_ => FieldKind::Text,
	}
}

impl Catalog {
	pub fn parse(json: &str) -> Result<Self, CatalogError> {
		let raw: RawCatalog = serde_json::from_str(json)?;
		if raw.version != CATALOG_VERSION {
			return Err(CatalogError::Version(raw.version));
		}
		let commands = raw
			.commands
			.into_iter()
			.map(|command| CommandSpec {
				fields: command
					.fields
					.into_iter()
					.map(|field| Field {
						kind: kind(&field.schema),
						description: field
							.schema
							.get("description")
							.and_then(Json::as_str)
							.map(str::to_owned),
						default: field.schema.get("default").cloned(),
						required: field.required,
						positional: command.positionals.contains(&field.name),
						name: field.name,
					})
					.collect(),
				name: command.name,
				description: command.description,
				summary: command.summary,
				path: command.path,
				positionals: command.positionals,
			})
			.collect();
		Ok(Self { commands })
	}

	pub fn get(&self, name: &str) -> Option<&CommandSpec> {
		self.commands.iter().find(|command| command.name == name)
	}
}
