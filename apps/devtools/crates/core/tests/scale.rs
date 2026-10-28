//! Discord-scale trees: React Native nests hundreds of components deep, and nothing that walks or
//! queries the tree may overflow a stack on that.

mod common;

use serde_json::Value as Json;
use unbound_devtools_core::Devtools;
use unbound_devtools_core::query::{self, FindQuery, NameMatch};

use common::{session, settle, spawn_device_with, wait_for};

fn rows(devtools: &Devtools) -> usize {
	query::find(
		&devtools.store(),
		&FindQuery {
			name: Some(NameMatch::Exact("Row".into())),
			..Default::default()
		},
	)
	.len()
}

/// Each output as compact JSON text, as the MCP `query` tool returns it.
fn jq(devtools: &Devtools, program: &str) -> Vec<String> {
	query::run_jq_on_tree(devtools, None, program, |output| output.to_string()).expect("jq runs")
}

async fn queries_survive(depth: u32, width: u32) {
	let (devtools, addr) = session();
	let Some(_device) = spawn_device_with(addr.port(), &[("DEPTH", depth), ("WIDTH", width)])
	else {
		return;
	};

	wait_for(&devtools, "every row", |devtools| {
		rows(devtools) == width as usize
	})
	.await;
	settle(&devtools).await;

	let deepest = devtools
		.store()
		.walk(None)
		.map(|element| element.depth)
		.max();
	// Host Views are filtered out, so a third of the nesting levels are not elements.
	assert!(
		deepest >= Some(depth * 2 / 3),
		"the tree is {deepest:?} deep"
	);

	let counts = jq(
		&devtools,
		r#"[.. | objects | select(has("name")) | .name] | group_by(.)
			| map({key: .[0], value: length}) | from_entries"#,
	);
	let counts: Json = serde_json::from_str(&counts[0]).expect("counts are JSON");
	assert_eq!(counts["Row"], Json::from(width));
	assert_eq!(counts["Pane"], Json::from((depth + 1) / 3));

	let whole = jq(&devtools, ".");
	assert_eq!(
		whole[0].matches(r#""name":"Row""#).count(),
		width as usize,
		"`.` echoes the whole tree as JSON, not {:.80}",
		whole[0]
	);

	let text = query::tree_text(&devtools.store(), None, None, usize::MAX);
	assert!(text.lines().count() > width as usize);
}

#[tokio::test(flavor = "multi_thread")]
async fn jq_over_a_600_deep_tree_survives() {
	queries_survive(600, 2000).await;
}

#[tokio::test(flavor = "multi_thread")]
async fn jq_over_a_2000_deep_tree_survives() {
	queries_survive(2000, 100).await;
}
