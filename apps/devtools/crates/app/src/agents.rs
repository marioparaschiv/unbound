//! The coding agents the MCP menu adds this app to, and how: a CLI's `mcp add` run for the user, an
//! editor's install link, or the bare URL to copy.

use std::process::Stdio;
use std::time::Duration;

use base64::Engine;
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use tokio::process::Command;

/// The name each agent registers the server under.
pub const SERVER_NAME: &str = "unbound-devtools";
/// A CLI that has not answered by then is waiting on something; the user can run the copy instead.
const RUN_TIMEOUT: Duration = Duration::from_secs(30);
/// What a POSIX shell exits with for a missing program; `cmd` uses 9009.
const NOT_FOUND: [i32; 2] = [127, 9009];

/// How one agent is added.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Install {
	/// Run `program args` for the user; `args` registers the server for every project.
	Cli {
		program: &'static str,
		args: Vec<String>,
	},
	/// Open an editor's install link, which asks the user to confirm.
	Link(String),
	/// Nothing to run: copy the text.
	Copy,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Agent {
	pub name: &'static str,
	pub install: Install,
	/// What the row shows and copies: the command a person would run, the link, or the URL.
	pub text: String,
}

/// How running an agent's CLI went.
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
	Added,
	NotInstalled,
	Failed(String),
}

/// The agents the menu lists, most used first, each pointed at `url`.
pub fn agents(url: &str) -> Vec<Agent> {
	let cli = |name, program, args: &[&str]| {
		let args: Vec<String> = args.iter().map(|arg| (*arg).to_owned()).collect();

		Agent {
			name,
			text: std::iter::once(program)
				.chain(args.iter().map(String::as_str))
				.collect::<Vec<_>>()
				.join(" "),
			install: Install::Cli { program, args },
		}
	};
	let link = |name, link: String| Agent {
		name,
		text: link.clone(),
		install: Install::Link(link),
	};

	vec![
		cli(
			"Claude Code",
			"claude",
			&[
				"mcp",
				"add",
				"--transport",
				"http",
				"--scope",
				"user",
				SERVER_NAME,
				url,
			],
		),
		cli("Codex", "codex", &["mcp", "add", SERVER_NAME, "--url", url]),
		cli(
			"Gemini CLI",
			"gemini",
			&[
				"mcp",
				"add",
				"--transport",
				"http",
				"--scope",
				"user",
				SERVER_NAME,
				url,
			],
		),
		link("Cursor", cursor_link(url)),
		link("VS Code", vscode_link(url)),
		Agent {
			name: "MCP URL",
			text: url.to_owned(),
			install: Install::Copy,
		},
	]
}

/// Cursor's install link: the server's config as base64 JSON.
fn cursor_link(url: &str) -> String {
	let config = serde_json::json!({ "url": url }).to_string();
	let config = base64::engine::general_purpose::STANDARD.encode(config);

	format!(
		"cursor://anysphere.cursor-deeplink/mcp/install?name={SERVER_NAME}&config={}",
		utf8_percent_encode(&config, NON_ALPHANUMERIC)
	)
}

/// VS Code's install link: the server's config as percent-encoded JSON.
fn vscode_link(url: &str) -> String {
	let config = serde_json::json!({ "name": SERVER_NAME, "type": "http", "url": url }).to_string();

	format!(
		"vscode:mcp/install?{}",
		utf8_percent_encode(&config, NON_ALPHANUMERIC)
	)
}

/// Runs an agent's CLI through the user's login shell, so it finds programs a GUI app's `PATH`
/// misses (Homebrew, `~/.local/bin`, npm's global folder).
pub async fn run(program: &'static str, args: Vec<String>) -> Outcome {
	finish(program, shell_command(program, &args)).await
}

/// Opens an editor's install link with the system's URL handler. A spawned opener rather than the
/// window's `open_url`, which on macOS waits on Launch Services while the editor starts.
pub async fn open(link: String) -> Outcome {
	let (program, command) = open_command(&link);
	finish(program, command).await
}

/// Runs `command` to its end, or to [`RUN_TIMEOUT`], and reads how it went.
async fn finish(program: &str, mut command: Command) -> Outcome {
	let output = command
		.stdin(Stdio::null())
		.stdout(Stdio::piped())
		.stderr(Stdio::piped())
		.kill_on_drop(true)
		.output();
	let output = match tokio::time::timeout(RUN_TIMEOUT, output).await {
		Ok(Ok(output)) => output,
		Ok(Err(error)) => return Outcome::Failed(error.to_string()),
		Err(_) => return Outcome::Failed(format!("{program} did not finish")),
	};
	let said = format!(
		"{}{}",
		String::from_utf8_lossy(&output.stdout),
		String::from_utf8_lossy(&output.stderr)
	);

	outcome(output.status.code(), &said)
}

/// A rerun that finds the server already registered counts as added.
fn outcome(code: Option<i32>, said: &str) -> Outcome {
	match code {
		Some(0) => Outcome::Added,
		Some(code) if NOT_FOUND.contains(&code) => Outcome::NotInstalled,
		_ if said.contains("already exists") => Outcome::Added,
		_ => Outcome::Failed(said.trim().lines().last().unwrap_or("it failed").to_owned()),
	}
}

#[cfg(unix)]
fn shell_command(program: &str, args: &[String]) -> Command {
	let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_owned());
	let mut command = Command::new(shell);

	// An interactive login shell reads both profile and rc files, where installers add to PATH.
	// `$0` and `$@` carry the words, so none is quoted by hand.
	command
		.args(["-ilc", r#"exec "$0" "$@""#, program])
		.args(args);
	command
}

#[cfg(windows)]
fn shell_command(program: &str, args: &[String]) -> Command {
	// `cmd` resolves npm's `.cmd` shims, which a bare spawn does not.
	let mut command = Command::new("cmd");

	command.arg("/C").arg(program).args(args);
	command
}

/// The system's URL opener with `link` as one argument, and its name for messages.
fn open_command(link: &str) -> (&'static str, Command) {
	let (program, args): (&str, &[&str]) = if cfg!(target_os = "macos") {
		("open", &[])
	} else if cfg!(windows) {
		// `rundll32` takes the link verbatim; `cmd /C start` would expand the `%` escapes in it.
		("rundll32", &["url.dll,FileProtocolHandler"])
	} else {
		("xdg-open", &[])
	};
	let mut command = Command::new(program);

	command.args(args).arg(link);
	(program, command)
}

#[cfg(test)]
mod tests {
	use super::*;

	const URL: &str = "http://127.0.0.1:8098/mcp";

	#[test]
	fn every_agent_points_at_the_url() {
		let agents = agents(URL);

		assert_eq!(
			agents[0].text,
			"claude mcp add --transport http --scope user unbound-devtools http://127.0.0.1:8098/mcp"
		);
		assert_eq!(
			agents[1].text,
			"codex mcp add unbound-devtools --url http://127.0.0.1:8098/mcp"
		);
		assert!(agents.iter().all(|agent| match &agent.install {
			Install::Cli { args, .. } => args.last().map(String::as_str) == Some(URL),
			Install::Link(link) => link == &agent.text,
			Install::Copy => agent.text == URL,
		}));
	}

	#[test]
	fn links_carry_the_config() {
		let cursor = cursor_link(URL);
		let config = cursor.split("config=").nth(1).expect("a config");
		let config = percent_encoding::percent_decode_str(config)
			.decode_utf8()
			.expect("UTF-8");
		let config = base64::engine::general_purpose::STANDARD
			.decode(config.as_bytes())
			.expect("base64");

		assert_eq!(config, br#"{"url":"http://127.0.0.1:8098/mcp"}"#);
		assert!(vscode_link(URL).starts_with("vscode:mcp/install?%7B%22name%22"));
	}

	#[test]
	fn reads_how_a_cli_run_went() {
		assert_eq!(outcome(Some(0), ""), Outcome::Added);
		assert_eq!(outcome(Some(127), ""), Outcome::NotInstalled);
		assert_eq!(
			outcome(
				Some(1),
				"MCP server unbound-devtools already exists in user config"
			),
			Outcome::Added
		);
		assert_eq!(
			outcome(Some(1), "warning\nerror: bad flag"),
			Outcome::Failed("error: bad flag".to_owned())
		);
	}
}
