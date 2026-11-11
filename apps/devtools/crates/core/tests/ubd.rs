use std::collections::HashMap;

use unbound_devtools_core::ubd::{
	ArgError, Catalog, CommandSpec, FieldKind, FieldValue, Launcher, arguments,
};

/// `ubd catalog` from `packages/cli`; regenerate it with `bun packages/cli/src/index.ts catalog`.
const FIXTURE: &str = include_str!("fixtures/catalog.json");

fn catalog() -> Catalog {
	Catalog::parse(FIXTURE).expect("the fixture parses")
}

fn command(name: &str) -> CommandSpec {
	catalog().get(name).cloned().expect("the command exists")
}

fn values(pairs: &[(&str, FieldValue)]) -> HashMap<String, FieldValue> {
	pairs
		.iter()
		.map(|(name, value)| ((*name).to_owned(), value.clone()))
		.collect()
}

fn text(value: &str) -> FieldValue {
	FieldValue::Text(value.to_owned())
}

#[test]
fn reads_every_command_and_its_fields() {
	let catalog = catalog();
	assert!(catalog.commands.len() > 20);
	let open = catalog.get("open").expect("open");
	assert_eq!(open.path, ["debug", "open"]);
	let create = catalog.get("create").expect("create");
	let kind = create.fields.iter().find(|field| field.name == "kind");
	assert_eq!(
		kind.map(|field| &field.kind),
		Some(&FieldKind::Choice(vec!["plugin".into(), "theme".into()]))
	);
	let hook = catalog.get("hook").expect("hook");
	assert_eq!(hook.positionals, ["className", "method"]);
	assert!(hook.fields[0].required && hook.fields[0].positional);
	assert_eq!(hook.fields[0].flag(), "--class-name");
}

#[test]
fn refuses_an_unknown_version() {
	let error = Catalog::parse(r#"{"version":2,"commands":[]}"#).unwrap_err();
	assert!(error.to_string().contains("version 2"));
}

#[test]
fn flags_come_before_positionals_and_defaults_are_left_out() {
	let args = arguments(
		&command("eval"),
		&values(&[
			("code", text("1 + 1")),
			("port", text("9090")),
			("timeout", text("500")),
		]),
	);
	assert_eq!(args.unwrap(), ["--timeout=500", "1 + 1"]);
}

#[test]
fn a_required_field_must_be_filled() {
	let args = arguments(&command("eval"), &values(&[]));
	assert_eq!(args, Err(ArgError::Missing("code".into())));
}

#[test]
fn booleans_turn_on_or_negate_their_default() {
	let args = arguments(
		&command("install"),
		&values(&[
			("build", FieldValue::Bool(false)),
			("ios", FieldValue::Bool(true)),
		]),
	);
	assert_eq!(args.unwrap(), ["--no-build", "--ios"]);
}

#[test]
fn list_flags_repeat_and_numbers_are_checked() {
	let check = arguments(&command("check"), &values(&[("plugin", text("a, b\nc"))]));
	assert_eq!(check.unwrap(), ["--plugin=a", "--plugin=b", "--plugin=c"]);
	let hook = arguments(
		&command("hook"),
		&values(&[
			("className", text("UIView")),
			("method", text("layoutSubviews")),
			("duration", text("soon")),
		]),
	);
	assert_eq!(hook, Err(ArgError::NotANumber("duration".into())));
}

#[test]
fn a_skipped_positional_takes_its_default_or_stops_the_run() {
	let inspect = arguments(&command("inspect"), &values(&[("what", text("views"))]));
	assert_eq!(inspect.unwrap(), ["views"]);
	let class = arguments(
		&command("inspect"),
		&values(&[("what", text("class")), ("name", text("UIView"))]),
	);
	assert_eq!(class.unwrap(), ["class", "UIView"]);
	let gap = arguments(
		&command("hook"),
		&values(&[("method", text("viewDidLoad"))]),
	);
	assert_eq!(
		gap,
		Err(ArgError::PositionalGap("className".into(), "method".into()))
	);
	let choice = arguments(&command("inspect"), &values(&[("what", text("wipe"))]));
	assert!(matches!(choice, Err(ArgError::NotAChoice(..))));
}

#[test]
fn launchers_split_and_quote_like_a_shell() {
	let launcher = Launcher::parse("bunx '@unbound-app/cli'").expect("a launcher");
	assert_eq!(launcher.program, "bunx");
	assert_eq!(launcher.prefix, ["@unbound-app/cli"]);
	assert_eq!(
		launcher.display(&["eval".into(), "it's".into()]),
		r"bunx @unbound-app/cli eval 'it'\''s'"
	);
	assert_eq!(Launcher::parse("   "), None);
}

#[cfg(unix)]
#[tokio::test]
async fn streams_both_outputs_then_the_exit_code() {
	use unbound_devtools_core::ubd::{RunEvent, Stream, spawn};

	let launcher = Launcher {
		program: "sh".into(),
		prefix: vec!["-c".into()],
	};
	let script = "echo out; echo err >&2; printf 'a\\rb\\n'; exit 3".to_owned();
	let mut run = spawn(
		&tokio::runtime::Handle::current(),
		&launcher,
		&[script],
		None,
	);
	let mut events = Vec::new();
	while let Some(event) = run.events.recv().await {
		events.push(event);
	}
	assert!(events.contains(&RunEvent::Line(Stream::Stdout, "out".into())));
	assert!(events.contains(&RunEvent::Line(Stream::Stderr, "err".into())));
	assert!(events.contains(&RunEvent::Line(Stream::Stdout, "b".into())));
	assert_eq!(events.last(), Some(&RunEvent::Exited(Some(3))));
}

#[cfg(unix)]
#[tokio::test]
async fn stop_kills_a_long_run() {
	use unbound_devtools_core::ubd::{RunEvent, spawn};

	let launcher = Launcher {
		program: "sh".into(),
		prefix: vec!["-c".into()],
	};
	let mut run = spawn(
		&tokio::runtime::Handle::current(),
		&launcher,
		&["echo ready; sleep 30".into()],
		None,
	);
	assert!(matches!(run.events.recv().await, Some(RunEvent::Line(..))));
	run.stop.send(()).ok();
	let mut last = None;
	while let Some(event) = run.events.recv().await {
		last = Some(event);
	}
	assert_eq!(last, Some(RunEvent::Exited(None)));
}

#[cfg(unix)]
#[tokio::test]
async fn a_missing_program_fails_to_start() {
	use unbound_devtools_core::ubd::{RunEvent, spawn};

	let launcher = Launcher::parse("unbound-no-such-program").expect("a launcher");
	let mut run = spawn(&tokio::runtime::Handle::current(), &launcher, &[], None);
	assert!(matches!(run.events.recv().await, Some(RunEvent::Failed(_))));
}
