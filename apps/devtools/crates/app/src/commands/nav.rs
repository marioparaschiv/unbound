//! Which `ubd` commands the sidebar shows, how it groups them, and the title and icon each one
//! shows. Only commands that show something about the running app get a page; scaffolding,
//! building, installing and publishing stay in the CLI, as does any command this table omits.

use unbound_devtools_core::ubd::{Catalog, CommandSpec};

pub struct Category {
	pub title: &'static str,
	pub commands: &'static [&'static str],
}

/// The group the Components and View Tree pages head; the sidebar puts them first in this group.
pub const COMPONENTS_GROUP: &str = "Inspect";
/// The native view finder's page title; it replaces the `views` command's page.
pub const VIEWS_TITLE: &str = "View Tree";
/// The native class browser's page title, under View Tree.
pub const CLASSES_TITLE: &str = "Classes";
/// The Metro module explorer's page title, under Classes.
pub const METRO_TITLE: &str = "Metro";

pub const CATEGORIES: &[Category] = &[
	// What is on screen: the React tree (Components), the native views (View Tree) and their text.
	Category {
		title: COMPONENTS_GROUP,
		commands: &["spans", "route"],
	},
	// What is loaded: run code against it, find modules, read native classes.
	Category {
		title: "Runtime",
		commands: &["eval", "modules", "inspect"],
	},
	// What happens over time: calls, samples and latencies recorded for a while.
	Category {
		title: "Record",
		commands: &["trace", "hook", "profile", "timing"],
	},
	Category {
		title: "Device",
		commands: &["status", "logs"],
	},
];

/// The catalog's commands the sidebar shows, grouped in the table's order. A group the CLI offers
/// nothing for is left out, except [`COMPONENTS_GROUP`], which always holds Components and View Tree.
pub fn group(catalog: &Catalog) -> Vec<(&'static str, Vec<&CommandSpec>)> {
	CATEGORIES
		.iter()
		.map(|category| {
			let commands = category
				.commands
				.iter()
				.filter_map(|name| catalog.get(name))
				.collect::<Vec<_>>();
			(category.title, commands)
		})
		.filter(|(title, commands)| *title == COMPONENTS_GROUP || !commands.is_empty())
		.collect()
}

/// The sidebar group a command sits in, for its page's breadcrumb.
pub fn group_of(name: &str) -> Option<&'static str> {
	CATEGORIES
		.iter()
		.find(|category| category.commands.contains(&name))
		.map(|category| category.title)
}

/// A command's name as a page title, in title case: `eval` is "Evaluate".
pub fn title(name: &str) -> String {
	let known = match name {
		"spans" => "Text Spans",
		"route" => "Current Route",
		"eval" => "Evaluate",
		"modules" => "Modules",
		"inspect" => "Native Classes",
		"trace" => "Trace Calls",
		"hook" => "Hook a Method",
		"profile" => "Profile",
		"timing" => "Latency",
		"status" => "Status",
		"logs" => "Logs",
		_ => {
			let mut chars = name.chars();
			return chars
				.next()
				.map(|first| first.to_uppercase().chain(chars).collect())
				.unwrap_or_default();
		}
	};
	known.to_owned()
}

/// The Lucide icon for a command, as an asset path.
pub fn icon(name: &str) -> &'static str {
	match name {
		"spans" => "icons/type.svg",
		"route" => "icons/route.svg",
		"eval" => "icons/square-terminal.svg",
		"modules" => "icons/boxes.svg",
		"inspect" => "icons/scan-search.svg",
		"trace" => "icons/radio.svg",
		"hook" => "icons/plug-zap.svg",
		"profile" => "icons/flame.svg",
		"timing" => "icons/gauge.svg",
		"status" => "icons/activity.svg",
		"logs" => "icons/scroll-text.svg",
		_ => "icons/terminal.svg",
	}
}

/// Commands that keep running until stopped, so their Run button reads "Start".
pub fn is_long_running(name: &str) -> bool {
	matches!(name, "logs")
}

#[cfg(test)]
mod tests {
	use unbound_devtools_core::ubd::{Catalog, CommandSpec};

	use super::{group, title};

	fn spec(name: &str) -> CommandSpec {
		CommandSpec {
			name: name.into(),
			description: String::new(),
			summary: None,
			path: vec![name.into()],
			positionals: Vec::new(),
			fields: Vec::new(),
		}
	}

	fn names(catalog: &Catalog) -> Vec<(&str, Vec<&str>)> {
		group(catalog)
			.into_iter()
			.map(|(title, commands)| {
				(
					title,
					commands
						.iter()
						.map(|command| command.name.as_str())
						.collect(),
				)
			})
			.collect()
	}

	#[test]
	fn cli_only_unknown_and_replaced_commands_stay_out_of_the_sidebar() {
		let catalog = Catalog {
			commands: vec![
				spec("logs"),
				spec("views"),
				spec("create"),
				spec("eval"),
				spec("teleport"),
				spec("status"),
			],
		};
		assert_eq!(
			names(&catalog),
			[
				("Inspect", vec![]),
				("Runtime", vec!["eval"]),
				("Device", vec!["status", "logs"]),
			]
		);
	}

	#[test]
	fn titles_fall_back_to_the_capitalised_name() {
		assert_eq!(title("eval"), "Evaluate");
		assert_eq!(title("teleport"), "Teleport");
	}
}
