use std::collections::HashSet;

use serde_json::Value as Json;
use unbound_devtools_core::inspect::InspectedElement;
use unbound_devtools_core::protocol::{self, Inbound, InspectedKind};
use unbound_devtools_core::query;
use unbound_devtools_core::{
	ElementId, ElementKind, FindQuery, JqFilter, NameMatch, PathSegment, Store, Value, operations,
};

fn inbound_frames() -> Vec<Inbound> {
	include_str!("fixtures/session-v8.jsonl")
		.lines()
		.filter(|line| line.contains(r#""dir":"in""#))
		.map(|line| protocol::parse(line).expect("every recorded frame parses"))
		.collect()
}

fn replayed_store() -> Store {
	let mut store = Store::default();

	for frame in inbound_frames() {
		if let Inbound::Operations(raw) = frame {
			let batch = operations::decode(&raw).expect("batch decodes");
			store.apply(&batch).expect("batch applies");
		}
	}

	store
}

fn outline(store: &Store, collapsed: &HashSet<ElementId>) -> Vec<String> {
	store
		.rows(collapsed)
		.iter()
		.map(|row| {
			let element = store.get(row.id).expect("row element exists");
			let key = element
				.key
				.as_deref()
				.map(|key| format!(" key={key}"))
				.unwrap_or_default();

			format!(
				"{}{} {}{key}",
				"  ".repeat(row.depth as usize),
				element.name,
				element.kind.label()
			)
		})
		.collect()
}

#[test]
fn replay_builds_the_host_tree_after_the_filter_change() {
	let store = replayed_store();

	assert_eq!(
		store.roots().len(),
		1,
		"one root after the remount replaced the first"
	);
	assert_eq!(
		outline(&store, &HashSet::new()),
		[
			"App function",
			"  Context.Provider context",
			"    Counter class",
			"      Text host",
			"    Channel function",
			"      ScrollView host",
			"        MessageRow memo key=m0",
			"          View host",
			"            Text host",
			"        MessageRow memo key=m1",
			"          View host",
			"            Text host",
			"        MessageRow memo key=m2",
			"          View host",
			"            Text host",
			"    ChatInput forward_ref",
			"      TextInput host",
		]
	);

	let row = store
		.walk(None)
		.find(|e| e.key.as_deref() == Some("m1"))
		.expect("m1 exists");
	assert_eq!(
		row.hocs.iter().map(|h| h.as_ref()).collect::<Vec<_>>(),
		["Memo"]
	);
	assert_eq!(
		store
			.ancestors(row.id)
			.map(|e| e.name.to_string())
			.collect::<Vec<_>>(),
		["ScrollView", "Channel", "Context.Provider", "App", "Root"]
	);
}

#[test]
fn find_filters_by_name_key_kind_and_subtree() {
	let store = replayed_store();
	let keys = |ids: Vec<ElementId>| -> Vec<String> {
		ids.iter()
			.map(|id| {
				store
					.get(*id)
					.and_then(|e| e.key.as_deref())
					.unwrap_or("-")
					.to_owned()
			})
			.collect()
	};
	let rows = FindQuery {
		name: Some(NameMatch::Contains("messagerow".into())),
		..Default::default()
	};

	assert_eq!(keys(query::find(&store, &rows)), ["m0", "m1", "m2"]);
	assert_eq!(
		keys(query::find(
			&store,
			&FindQuery {
				key: Some("m1".into()),
				..rows.clone()
			}
		)),
		["m1"]
	);
	assert_eq!(
		keys(query::find(
			&store,
			&FindQuery {
				limit: Some(2),
				..rows.clone()
			}
		)),
		["m0", "m1"]
	);

	let counter = query::find(
		&store,
		&FindQuery {
			name: Some(NameMatch::Exact("Counter".into())),
			..Default::default()
		},
	);
	let hosts_in_counter = query::find(
		&store,
		&FindQuery {
			kinds: vec![ElementKind::Host],
			within: counter.first().copied(),
			..Default::default()
		},
	);
	let names: Vec<_> = hosts_in_counter
		.iter()
		.map(|id| store.get(*id).map(|e| e.name.to_string()))
		.collect();
	assert_eq!(names, [Some("Text".to_owned())]);
}

#[test]
fn tree_text_outlines_with_ids_kinds_and_limits() {
	let store = replayed_store();
	let text = query::tree_text(&store, None, None, 1000);
	let lines: Vec<&str> = text.lines().collect();

	assert_eq!(lines.len(), 17);
	assert!(lines[0].starts_with("<App> #"), "{text}");
	assert!(
		lines[2].starts_with("    <Counter> #") && lines[2].ends_with(" class"),
		"{text}"
	);
	assert!(
		lines[6].starts_with("        <MessageRow key=\"m0\"> #") && lines[6].ends_with(" memo")
	);

	let capped = query::tree_text(&store, None, None, 3);
	assert_eq!(capped.lines().count(), 4);
	assert!(
		capped.ends_with("14 more elements not shown (raise max_nodes or pick a root)"),
		"{capped}"
	);

	let shallow = query::tree_text(&store, None, Some(1), 100);
	assert_eq!(shallow.lines().count(), 2, "{shallow}");
	assert!(
		shallow
			.lines()
			.nth(1)
			.is_some_and(|line| line.ends_with("(+15 below)")),
		"{shallow}"
	);
}

#[test]
fn jq_runs_over_the_tree_json() {
	let store = replayed_store();
	let tree = query::tree_json(&store, None, None);
	let keys = JqFilter::compile(r#"[.. | objects | select(.name == "MessageRow") | .key]"#)
		.expect("compiles")
		.run(tree.clone())
		.expect("runs");

	assert_eq!(keys, [serde_json::json!(["m0", "m1", "m2"])]);

	let is_memo = JqFilter::compile(r#".kind == "memo""#).expect("compiles");
	assert!(
		is_memo
			.matches(serde_json::json!({ "kind": "memo" }))
			.expect("runs")
	);
	assert!(
		!is_memo
			.matches(serde_json::json!({ "kind": "host" }))
			.expect("runs")
	);
	assert!(JqFilter::compile("select(").is_err());

	let shallow = query::tree_json(&store, None, Some(2));
	assert_eq!(
		shallow[0]["children"][0]["children"][0]["truncated"],
		serde_json::json!(15)
	);
}

#[test]
fn collapsing_hides_only_the_subtree() {
	let store = replayed_store();
	let channel = store
		.walk(None)
		.find(|e| &*e.name == "Channel")
		.expect("Channel exists")
		.id;
	let rows = store.rows(&HashSet::from([channel]));
	let outline = outline(&store, &HashSet::from([channel]));

	assert_eq!(
		outline[4..],
		[
			"    Channel function",
			"    ChatInput forward_ref",
			"      TextInput host"
		]
	);
	let channel_row = rows
		.iter()
		.find(|row| row.id == channel)
		.expect("Channel row");
	assert!(channel_row.has_children && !channel_row.expanded);
}

fn inspected(response_id: u64) -> (Json, Option<Vec<PathSegment>>, InspectedKind) {
	inbound_frames()
		.into_iter()
		.find_map(|frame| match frame {
			Inbound::InspectedElement(payload) if payload.response_id == response_id => {
				Some((payload.value, payload.path, payload.kind))
			}
			_ => None,
		})
		.expect("response recorded")
}

fn key(segment: &str) -> PathSegment {
	PathSegment::Key(segment.to_owned())
}

#[test]
fn dehydrated_values_become_typed_placeholders() {
	let (value, _, kind) = inspected(7);
	assert_eq!(kind, InspectedKind::FullData);
	let element = InspectedElement::from_payload(&value).expect("full-data parses");

	assert_eq!(element.key.as_deref(), Some("m2"));
	assert_eq!(element.kind, ElementKind::Memo);
	let props = element.props.as_ref().expect("props");
	assert_eq!(
		props.get(&[key("message"), key("content")]),
		Some(&Value::String("hello 2".to_owned()))
	);

	let Some(Value::Dehydrated(author)) = props.get(&[key("message"), key("author")]) else {
		panic!("message.author is a placeholder");
	};
	assert_eq!(
		(author.kind.as_str(), author.inspectable, author.size),
		("object", true, Some(3))
	);

	let names: Vec<&str> = element
		.hooks
		.iter()
		.map(|hook| hook.name.as_str())
		.collect();
	assert_eq!(names, ["State", "Context", "Ref", "Effect"]);
	assert_eq!(element.hooks[0].id, Some(0));
	assert!(element.hooks[0].editable);
	assert!(matches!(&element.hooks[3].value, Value::Dehydrated(meta) if meta.kind == "function"));
	assert_eq!(
		element.owners.first().map(|owner| owner.name.as_str()),
		Some("Channel")
	);
}

#[test]
fn a_hydrated_path_splices_into_the_element() {
	let (value, _, _) = inspected(7);
	let mut element = InspectedElement::from_payload(&value).expect("full-data parses");
	let (hydrated, path, kind) = inspected(12);
	let path = path.expect("hydrated-path carries its path");

	assert_eq!(kind, InspectedKind::HydratedPath);
	let author = Value::from_dehydrated_at(&hydrated, &path);
	element.set_value_at(&path, author);

	let username = element.value_at(&[key("props"), key("author"), key("username")]);
	assert_eq!(username, Some(Value::String("user2".to_owned())));

	let deep = element.value_at(&[key("props"), key("author"), key("nested"), key("deep")]);
	let Some(Value::Dehydrated(deep)) = deep else {
		panic!("nested.deep is still a placeholder one level further down");
	};
	assert_eq!(deep.preview_long, "{deeper: Array(3)}");

	let mut props = element.props.clone().expect("props");
	props.set(&[key("author"), key("nested")], Value::Number(42.0));
	assert_eq!(props.to_json()["author"]["nested"], Json::from(42));
}
