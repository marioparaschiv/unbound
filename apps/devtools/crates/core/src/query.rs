//! Finding elements: the `findInReactTree` of this app.
//!
//! Two layers. [`find`] filters the tree by name, key, kind and subtree with no device round trip.
//! [`run_jq_on_tree`] runs a jq program (via jaq) over the tree as JSON, and [`find_by_props`] over
//! inspected props, so `.. | objects | select(.name == "MessageRow" and .key != null) | .id` works
//! as an agent expects.

use jaq_core::data::JustLut;
use jaq_core::load::{Arena, File, Loader};
use jaq_core::{Ctx, Vars, unwrap_valr};
use jaq_json::Val;
use serde_json::{Value as Json, json};

use futures_util::{StreamExt, stream};

use crate::session::Devtools;
use crate::store::{Element, ElementId, ElementKind, Store};

#[derive(Clone, Debug)]
pub enum NameMatch {
	Exact(String),
	/// Case-insensitive substring; what the search box does.
	Contains(String),
	Regex(regex::Regex),
}

#[derive(Clone, Debug, Default)]
pub struct FindQuery {
	pub name: Option<NameMatch>,
	pub key: Option<String>,
	pub kinds: Vec<ElementKind>,
	/// Only descendants of this element.
	pub within: Option<ElementId>,
	pub limit: Option<usize>,
}

impl NameMatch {
	pub fn matches(&self, name: &str) -> bool {
		match self {
			Self::Exact(wanted) => name == wanted,
			Self::Contains(wanted) => name.to_lowercase().contains(&wanted.to_lowercase()),
			Self::Regex(regex) => regex.is_match(name),
		}
	}
}

/// Matching ids in tree (preorder) order. Roots match only when `kinds` asks for them.
pub fn find(store: &Store, query: &FindQuery) -> Vec<ElementId> {
	let candidates = store
		.walk(query.within)
		.skip(usize::from(query.within.is_some()));

	candidates
		.filter(|element| match query.kinds.as_slice() {
			[] => element.kind != ElementKind::Root,
			kinds => kinds.contains(&element.kind),
		})
		.filter(|element| {
			query
				.name
				.as_ref()
				.is_none_or(|name| name.matches(&element.name))
		})
		.filter(|element| {
			query
				.key
				.as_ref()
				.is_none_or(|key| element.key.as_deref() == Some(key))
		})
		.map(|element| element.id)
		.take(query.limit.unwrap_or(usize::MAX))
		.collect()
}

pub const MAX_PROPS_CANDIDATES: usize = 200;
const PROPS_CONCURRENCY: usize = 8;

/// What [`find_by_props`] found and how far it looked.
#[derive(Debug, Default)]
pub struct PropsMatches {
	pub ids: Vec<ElementId>,
	/// Candidates that passed the store filters, before the [`MAX_PROPS_CANDIDATES`] cap.
	pub candidates: usize,
	pub inspected: usize,
	/// Candidates the device could not inspect or the predicate errored on, with why.
	pub failures: Vec<(ElementId, String)>,
}

impl PropsMatches {
	pub fn capped(&self) -> bool {
		self.candidates > MAX_PROPS_CANDIDATES
	}
}

/// [`find`], then keeps the candidates whose inspected element (as
/// [`crate::InspectedElement::to_json`]) satisfies the jq `predicate`, e.g.
/// `.props.message.id == "1"`. Inspects at most [`MAX_PROPS_CANDIDATES`], a few at a time.
pub async fn find_by_props(
	devtools: &Devtools,
	query: &FindQuery,
	predicate: &str,
) -> Result<PropsMatches, String> {
	JqFilter::compile(predicate).map(drop)?;

	let candidates = {
		let store = devtools.store();
		find(
			&store,
			&FindQuery {
				limit: None,
				..query.clone()
			},
		)
	};
	let inspections: Vec<_> = stream::iter(candidates.iter().take(MAX_PROPS_CANDIDATES).copied())
		.map(|id| async move { (id, devtools.inspect(id).await) })
		.buffered(PROPS_CONCURRENCY)
		.collect()
		.await;
	let mut matches = PropsMatches {
		candidates: candidates.len(),
		inspected: inspections.len(),
		..Default::default()
	};
	let inputs = inspections
		.iter()
		.filter_map(|(_, inspection)| inspection.as_ref().ok())
		.map(crate::InspectedElement::to_json)
		.collect();
	let mut verdicts = run_jq_deep(predicate, inputs, |outputs| {
		outputs.map(|outputs| truthy(&outputs))
	})?
	.into_iter();
	let limit = query.limit.unwrap_or(usize::MAX);

	for (id, inspection) in inspections {
		let verdict = match inspection {
			Ok(_) => verdicts.next().unwrap_or(Ok(false)),
			Err(error) => Err(error.to_string()),
		};

		match verdict {
			Ok(true) if matches.ids.len() < limit => matches.ids.push(id),
			Ok(_) => {}
			Err(error) => matches.failures.push((id, error)),
		}
	}

	Ok(matches)
}

/// The tree as nested JSON: `{id, name, kind, key, hocs, errors, warnings, children: [...]}`.
/// `max_depth` counts from `root`; elements past it carry `"truncated": <descendant count>`.
/// With no `root`, an array of every root.
pub fn tree_json(store: &Store, root: Option<ElementId>, max_depth: Option<u32>) -> Json {
	let max_depth = max_depth.unwrap_or(u32::MAX);

	match root {
		Some(id) => node_json(store, id, max_depth),
		None => store
			.roots()
			.iter()
			.map(|id| node_json(store, *id, max_depth))
			.collect(),
	}
}

struct OpenNode<'a> {
	node: Json,
	depth: u32,
	pending: std::slice::Iter<'a, ElementId>,
	children: Vec<Json>,
}

enum Visited<'a> {
	Done(Json),
	Open(OpenNode<'a>),
}

fn node_json(store: &Store, id: ElementId, max_depth: u32) -> Json {
	let mut stack = match visit(store, id, 0, max_depth) {
		Visited::Done(node) => return node,
		Visited::Open(open) => vec![open],
	};

	while let Some(top) = stack.last_mut() {
		if let Some(child) = top.pending.next() {
			match visit(store, *child, top.depth + 1, max_depth) {
				Visited::Done(node) => top.children.push(node),
				Visited::Open(open) => stack.push(open),
			}

			continue;
		}

		let Some(OpenNode {
			mut node, children, ..
		}) = stack.pop()
		else {
			break;
		};

		node["children"] = Json::Array(children);

		match stack.last_mut() {
			Some(parent) => parent.children.push(node),
			None => return node,
		}
	}

	Json::Null
}

fn visit(store: &Store, id: ElementId, depth: u32, max_depth: u32) -> Visited<'_> {
	let Some(element) = store.get(id) else {
		return Visited::Done(Json::Null);
	};
	let mut node = json!({
		"id": element.id,
		"name": element.name,
		"kind": element.kind,
		"key": element.key,
		"hocs": element.hocs,
		"errors": element.errors,
		"warnings": element.warnings,
	});

	if depth >= max_depth && !element.children.is_empty() {
		node["truncated"] = Json::from(store.walk(Some(id)).count() - 1);
		node["children"] = json!([]);
		return Visited::Done(node);
	}

	Visited::Open(OpenNode {
		node,
		depth,
		pending: element.children.iter(),
		children: Vec::with_capacity(element.children.len()),
	})
}

/// Runs `program` over [`tree_json`] of `root` (every root when `None`) and maps each output
/// through `each`. The MCP `query` tool and the GUI's jq search both go through here.
///
/// # Errors
///
/// When the program does not compile, fails on the tree, or its thread cannot start.
pub fn run_jq_on_tree<T: Send>(
	devtools: &Devtools,
	root: Option<ElementId>,
	program: &str,
	each: impl Fn(Json) -> T + Sync,
) -> Result<Vec<T>, String> {
	let tree = tree_json(&devtools.store(), root, None);
	let mut results = run_jq_deep(program, vec![tree], |outputs| {
		outputs.map(|outputs| outputs.into_iter().map(&each).collect::<Vec<_>>())
	})?;

	results.pop().unwrap_or_else(|| Ok(Vec::new()))
}

/// The jq thread's stack. jaq's evaluator, its JSON reader and writer, and dropping a nested
/// [`Json`] all recurse once per tree level, and Discord's tree overflowed a default 2 MiB stack.
/// Pages are committed only as touched, so this reserves address space, not memory.
const JQ_STACK_BYTES: usize = 512 << 20;

fn run_jq_deep<T: Send>(
	program: &str,
	inputs: Vec<Json>,
	each: impl Fn(Result<Vec<Json>, String>) -> T + Sync,
) -> Result<Vec<T>, String> {
	std::thread::scope(|scope| {
		std::thread::Builder::new()
			.name("jq".into())
			.stack_size(JQ_STACK_BYTES)
			.spawn_scoped(scope, || {
				let filter = JqFilter::compile(program)?;

				Ok(inputs
					.into_iter()
					.map(|input| each(filter.run(input)))
					.collect())
			})
			.map_err(|error| format!("cannot start the jq thread: {error}"))?
			.join()
			.map_err(|_| "the jq thread panicked".to_owned())?
	})
}

/// An indented text outline for agents: `  <MessageRow key="m1"> #42 memo`.
/// Stops after `max_nodes` lines and says how many it left out. Roots are not printed; with no
/// `root` (or a root id) the outline starts at their children.
pub fn tree_text(
	store: &Store,
	root: Option<ElementId>,
	max_depth: Option<u32>,
	max_nodes: usize,
) -> String {
	let max_depth = max_depth.unwrap_or(u32::MAX);
	let starts: Vec<ElementId> = match root.and_then(|id| store.get(id)) {
		Some(element) if element.kind != ElementKind::Root => vec![element.id],
		Some(element) => element.children.clone(),
		None if root.is_some() => {
			return format!("#{} is not in the tree", root.map_or(0, |id| id.0));
		}
		None => store
			.roots()
			.iter()
			.filter_map(|id| store.get(*id))
			.flat_map(|root| root.children.iter().copied())
			.collect(),
	};
	let mut stack: Vec<(ElementId, u32)> = starts.iter().rev().map(|id| (*id, 0)).collect();
	let mut lines = Vec::new();
	let mut omitted = 0;

	while let Some((id, depth)) = stack.pop() {
		let Some(element) = store.get(id) else {
			continue;
		};

		if lines.len() >= max_nodes {
			omitted += 1;
			stack.extend(element.children.iter().map(|child| (*child, depth + 1)));
			continue;
		}

		let mut line = format!("{}{}", "  ".repeat(depth as usize), element_label(element));

		if depth >= max_depth && !element.children.is_empty() {
			let hidden = store.walk(Some(id)).count() - 1;
			line.push_str(&format!(" (+{hidden} below)"));
		} else {
			stack.extend(
				element
					.children
					.iter()
					.rev()
					.map(|child| (*child, depth + 1)),
			);
		}

		lines.push(line);
	}

	if omitted > 0 {
		lines.push(format!(
			"… {omitted} more elements not shown (raise max_nodes or pick a root)"
		));
	}

	lines.join("\n")
}

/// `<MessageRow key="m1"> #42 memo !2 ?1`: name, key, id, kind unless function/host, then error
/// and warning counts.
pub fn element_label(element: &Element) -> String {
	let mut label = format!("<{}", element.name);

	if let Some(key) = &element.key {
		label.push_str(&format!(" key={}", Json::from(key.as_ref())));
	}

	label.push_str(&format!("> #{}", element.id.0));

	if !matches!(element.kind, ElementKind::Function | ElementKind::Host) {
		label.push(' ');
		label.push_str(element.kind.label());
	}

	if element.errors > 0 {
		label.push_str(&format!(" !{}", element.errors));
	}

	if element.warnings > 0 {
		label.push_str(&format!(" ?{}", element.warnings));
	}

	label
}

type Compiled = jaq_core::compile::Filter<jaq_core::Native<JustLut<Val>>>;

/// A compiled jq program.
pub struct JqFilter {
	source: String,
	filter: Compiled,
}

impl JqFilter {
	pub fn compile(source: &str) -> Result<Self, String> {
		let defs = jaq_core::defs()
			.chain(jaq_std::defs())
			.chain(jaq_json::defs());
		let funs = jaq_core::funs()
			.chain(jaq_std::funs())
			.chain(jaq_json::funs());
		let arena = Arena::default();
		let modules = Loader::new(defs)
			.load(
				&arena,
				File {
					code: source,
					path: (),
				},
			)
			.map_err(|errors| format!("jq parse error: {errors:?}"))?;
		let filter = jaq_core::Compiler::default()
			.with_funs(funs)
			.compile(modules)
			.map_err(|errors| format!("jq compile error: {errors:?}"))?;

		Ok(Self {
			source: source.to_owned(),
			filter,
		})
	}

	pub fn source(&self) -> &str {
		&self.source
	}

	/// Every output the program yields for `input`, on this thread. A deeply nested `input` can
	/// overflow its stack; [`run_jq_on_tree`] runs on one sized for the element tree.
	pub fn run(&self, input: Json) -> Result<Vec<Json>, String> {
		let input = jaq_json::read::parse_single(input.to_string().as_bytes())
			.map_err(|error| format!("jq input: {error:?}"))?;
		let ctx = Ctx::<JustLut<Val>>::new(&self.filter.lut, Vars::new([]));

		self.filter
			.id
			.run((ctx, input))
			.map(unwrap_valr)
			.map(|output| match output {
				Ok(value) => Ok(val_to_json(&value)),
				Err(error) => Err(format!("jq: {error}")),
			})
			.collect()
	}

	/// True when the program's first output is truthy (jq's `select` semantics).
	pub fn matches(&self, input: Json) -> Result<bool, String> {
		Ok(truthy(&self.run(input)?))
	}
}

fn truthy(outputs: &[Json]) -> bool {
	!matches!(
		outputs.first(),
		None | Some(Json::Null) | Some(Json::Bool(false))
	)
}

/// Converts directly: serde_json's parser refuses input nested past 128 levels, and a subtree of
/// the element tree is deeper. Values JSON lacks (`NaN`, byte strings) come back as text.
fn val_to_json(value: &Val) -> Json {
	match value {
		Val::Null => Json::Null,
		Val::Bool(bool) => Json::Bool(*bool),
		Val::Num(num) => {
			let text = num.to_string();

			serde_json::from_str(&text).unwrap_or(Json::String(text))
		}
		Val::TStr(bytes) => Json::String(String::from_utf8_lossy(bytes).into_owned()),
		Val::BStr(_) => Json::String(value.to_string()),
		Val::Arr(items) => items.iter().map(val_to_json).collect(),
		Val::Obj(entries) => Json::Object(
			entries
				.iter()
				.map(|(key, value)| {
					let key = match key {
						Val::TStr(bytes) => String::from_utf8_lossy(bytes).into_owned(),
						other => other.to_string(),
					};

					(key, val_to_json(value))
				})
				.collect(),
		),
	}
}
