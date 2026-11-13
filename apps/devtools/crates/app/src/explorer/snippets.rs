//! "Copy as plugin code": a member as the plugin code that reaches it through `context.native`, in
//! the shapes `packages/types/typings/native-objc.ts` and `native-java.ts` declare. iOS reads with
//! `objc.call` and `objc.getIvar` and patches with `objc.hook`; Android reads with `java.getField`
//! and `java.invoke` and patches with `hooks.hook`, which takes the parameter types.

use std::fmt::Write;

use unbound_devtools_core::{ExplorerMember, ExplorerMemberKind, ExplorerPlatform};

/// The variable a snippet calls on; the explorer cannot know what the plugin names its handle.
const OBJECT: &str = "object";

/// The plugin code for `member`, declared by `class_name`. `None` for kinds a plugin cannot reach
/// directly: protocols and interfaces.
pub fn plugin_code(
	platform: ExplorerPlatform,
	class_name: &str,
	member: &ExplorerMember,
) -> Option<String> {
	match platform {
		ExplorerPlatform::Ios => objc(class_name, member),
		ExplorerPlatform::Android => java(class_name, member),
	}
}

fn quote(text: &str) -> String {
	format!("'{}'", text.replace('\\', "\\\\").replace('\'', "\\'"))
}

/// `arg0, arg1, …`, one per parameter.
fn placeholders(count: usize) -> Vec<String> {
	(0..count).map(|ix| format!("arg{ix}")).collect()
}

/// `// args[0]: NSString *` lines inside a hook handler, one per parameter.
fn argument_notes(parameters: &[String]) -> String {
	parameters
		.iter()
		.enumerate()
		.map(|(ix, ty)| format!("\t\t// args[{ix}]: {ty}\n"))
		.collect()
}

fn declaration(member: &ExplorerMember) -> String {
	member
		.signature
		.clone()
		.unwrap_or_else(|| match &member.ty {
			Some(ty) => format!("{ty} {}", member.name),
			None => member.name.clone(),
		})
}

fn objc(class_name: &str, member: &ExplorerMember) -> Option<String> {
	let mut code = String::from("const { objc } = context.native;\n\n");
	let _ = writeln!(code, "// {}", declaration(member));
	let class = format!("objc.getClass({})", quote(class_name));
	match member.kind {
		ExplorerMemberKind::Properties => {
			let target = if member.has_attribute("class") {
				class.as_str()
			} else {
				OBJECT
			};
			let getter = member.attribute("getter").unwrap_or(&member.name);
			let _ = writeln!(
				code,
				"const value = objc.call({target}, {});",
				quote(getter)
			);
			if !member.has_attribute("readonly") {
				let setter = member
					.attribute("setter")
					.map_or_else(|| setter_name(&member.name), str::to_owned);
				let _ = writeln!(code, "objc.call({target}, {}, value);", quote(&setter));
			}
		}
		ExplorerMemberKind::Ivars => {
			let _ = writeln!(
				code,
				"const value = objc.getIvar({OBJECT}, {});",
				quote(&member.name)
			);
		}
		ExplorerMemberKind::Methods => {
			let parameters = objc_parameters(member);
			let _ = write!(
				code,
				"objc.hook({}, {}, {{\n\tafter: ({{ self, args }}) => {{\n{}\t}},\n}});\n\n",
				quote(class_name),
				quote(&member.name),
				argument_notes(&parameters),
			);
			let _ = writeln!(
				code,
				"{};",
				objc_call(OBJECT, &member.name, parameters.len())
			);
		}
		ExplorerMemberKind::ClassMethods => {
			let count = objc_parameters(member).len();
			code.push_str("// objc.hook reaches instance methods only.\n");
			let _ = writeln!(code, "{};", objc_call(&class, &member.name, count));
		}
		_ => return None,
	}
	Some(code)
}

/// The parameter types, or one unnamed parameter per colon in the selector.
fn objc_parameters(member: &ExplorerMember) -> Vec<String> {
	member.parameters.clone().unwrap_or_else(|| {
		let count = member.name.matches(':').count();
		vec!["id".to_owned(); count]
	})
}

fn objc_call(target: &str, selector: &str, count: usize) -> String {
	let arguments: String = placeholders(count)
		.iter()
		.map(|argument| format!(", {argument}"))
		.collect();
	format!(
		"const result = objc.call({target}, {}{arguments})",
		quote(selector)
	)
}

/// `textColor` -> `setTextColor:`, the setter Objective-C names for a property without `setter=`.
fn setter_name(property: &str) -> String {
	let mut chars = property.chars();
	let first = chars
		.next()
		.map(|first| first.to_uppercase().collect::<String>());
	format!("set{}{}:", first.unwrap_or_default(), chars.as_str())
}

fn java(class_name: &str, member: &ExplorerMember) -> Option<String> {
	let parameters = member.parameters.clone().unwrap_or_default();
	let class = format!("java.getClass({})", quote(class_name));
	let target = if member.is_static() {
		class.as_str()
	} else {
		OBJECT
	};
	let mut code = String::new();
	match member.kind {
		ExplorerMemberKind::Fields => {
			code.push_str("const { java } = context.native;\n\n");
			let _ = writeln!(code, "// {}", java_declaration(member));
			let _ = writeln!(
				code,
				"const value = java.getField({target}, {});",
				quote(&member.name)
			);
		}
		ExplorerMemberKind::Methods => {
			code.push_str("const { java, hooks } = context.native;\n\n");
			let _ = writeln!(code, "// {}", java_declaration(member));
			let types: Vec<String> = parameters.iter().map(|ty| quote(ty)).collect();
			let receiver = if member.is_static() {
				"args"
			} else {
				"self, args"
			};
			let _ = write!(
				code,
				"hooks.hook({}, {}, [{}], {{ notify: 'after' }}, ({{ {receiver} }}) => {{\n{}}});\n\n",
				quote(class_name),
				quote(&member.name),
				types.join(", "),
				argument_notes(&parameters).replace("\t\t", "\t"),
			);
			let _ = writeln!(
				code,
				"const result = java.invoke({target}, {}, [{}]);",
				quote(&member.name),
				java_arguments(&parameters)
			);
		}
		ExplorerMemberKind::Constructors => {
			code.push_str("const { java } = context.native;\n\n");
			let _ = writeln!(code, "// new {class_name}({})", parameters.join(", "));
			let _ = writeln!(
				code,
				"const instance = java.construct({}, [{}]);",
				quote(class_name),
				java_arguments(&parameters)
			);
		}
		_ => return None,
	}
	Some(code)
}

fn java_declaration(member: &ExplorerMember) -> String {
	if let Some(signature) = &member.signature {
		return signature.clone();
	}
	let prefix = if member.is_static() { "static " } else { "" };
	match member.kind {
		ExplorerMemberKind::Methods => format!(
			"{prefix}{} {}({})",
			member
				.return_type
				.as_deref()
				.or(member.ty.as_deref())
				.unwrap_or("void"),
			member.name,
			member.parameters.as_deref().unwrap_or_default().join(", ")
		),
		_ => format!(
			"{prefix}{} {}",
			member.ty.as_deref().unwrap_or("Object"),
			member.name
		),
	}
}

/// One argument per parameter: a tagged default for a primitive or a string, `argN` for an object.
fn java_arguments(parameters: &[String]) -> String {
	parameters
		.iter()
		.enumerate()
		.map(|(ix, ty)| match ty.as_str() {
			"boolean" => "{ type: 'boolean', value: false }".to_owned(),
			"byte" | "short" | "int" | "long" | "float" | "double" => {
				format!("{{ type: '{ty}', value: 0 }}")
			}
			"char" => "{ type: 'char', value: 'a' }".to_owned(),
			"java.lang.String" => "{ type: 'string', value: '' }".to_owned(),
			_ => format!("arg{ix}"),
		})
		.collect::<Vec<_>>()
		.join(", ")
}

#[cfg(test)]
mod tests {
	use serde_json::json;
	use unbound_devtools_core::{ExplorerMember, ExplorerPlatform};

	use super::plugin_code;

	fn member(value: serde_json::Value) -> ExplorerMember {
		serde_json::from_value(value).expect("a member")
	}

	#[test]
	fn an_ios_property_reads_with_its_getter_and_writes_with_its_setter() {
		let hidden = member(json!({
			"name": "hidden", "kind": "properties", "type": "BOOL",
			"signature": "@property (nonatomic, getter=isHidden) BOOL hidden",
			"attributes": ["nonatomic", "getter=isHidden"], "read": "manual",
		}));
		assert_eq!(
			plugin_code(ExplorerPlatform::Ios, "UIView", &hidden).unwrap(),
			"const { objc } = context.native;\n\n\
			 // @property (nonatomic, getter=isHidden) BOOL hidden\n\
			 const value = objc.call(object, 'isHidden');\n\
			 objc.call(object, 'setHidden:', value);\n"
		);

		let readonly = member(json!({
			"name": "layer", "kind": "properties", "type": "CALayer *",
			"signature": null, "attributes": ["readonly"], "read": "auto",
		}));
		let code = plugin_code(ExplorerPlatform::Ios, "UIView", &readonly).unwrap();
		assert!(code.contains("// CALayer * layer\n"));
		assert!(!code.contains("setLayer:"));
	}

	#[test]
	fn an_ios_ivar_reads_with_get_ivar_and_a_method_hooks_by_class_and_selector() {
		let ivar = member(
			json!({ "name": "_textColor", "kind": "ivars", "type": "UIColor *", "read": "auto" }),
		);
		assert!(
			plugin_code(ExplorerPlatform::Ios, "UILabel", &ivar)
				.unwrap()
				.ends_with("const value = objc.getIvar(object, '_textColor');\n")
		);

		let method = member(json!({
			"name": "setText:", "kind": "methods", "type": "void",
			"signature": "- (void)setText:(NSString *)text", "parameters": ["NSString *"], "read": "never",
		}));
		assert_eq!(
			plugin_code(ExplorerPlatform::Ios, "UILabel", &method).unwrap(),
			"const { objc } = context.native;\n\n\
			 // - (void)setText:(NSString *)text\n\
			 objc.hook('UILabel', 'setText:', {\n\
			 \tafter: ({ self, args }) => {\n\
			 \t\t// args[0]: NSString *\n\
			 \t},\n\
			 });\n\n\
			 const result = objc.call(object, 'setText:', arg0);\n"
		);
	}

	#[test]
	fn an_ios_class_method_calls_the_class_and_protocols_have_no_code() {
		let method = member(json!({
			"name": "colorWithWhite:alpha:", "kind": "classMethods", "type": "UIColor *", "read": "never",
		}));
		assert!(
			plugin_code(ExplorerPlatform::Ios, "UIColor", &method)
				.unwrap()
				.ends_with(
					"objc.call(objc.getClass('UIColor'), 'colorWithWhite:alpha:', arg0, arg1);\n"
				)
		);
		let protocol = member(json!({ "name": "NSCoding", "kind": "protocols", "read": "never" }));
		assert_eq!(
			plugin_code(ExplorerPlatform::Ios, "UIView", &protocol),
			None
		);
	}

	#[test]
	fn an_android_method_hooks_with_its_parameter_types_and_invokes_with_tagged_values() {
		let method = member(json!({
			"name": "setText", "kind": "methods", "type": "void", "returnType": "void",
			"signature": null, "parameters": ["java.lang.CharSequence", "int"], "static": false, "read": "never",
		}));
		assert_eq!(
			plugin_code(
				ExplorerPlatform::Android,
				"android.widget.TextView",
				&method
			)
			.unwrap(),
			"const { java, hooks } = context.native;\n\n\
			 // void setText(java.lang.CharSequence, int)\n\
			 hooks.hook('android.widget.TextView', 'setText', ['java.lang.CharSequence', 'int'], { notify: 'after' }, ({ self, args }) => {\n\
			 \t// args[0]: java.lang.CharSequence\n\
			 \t// args[1]: int\n\
			 });\n\n\
			 const result = java.invoke(object, 'setText', [arg0, { type: 'int', value: 0 }]);\n"
		);
	}

	#[test]
	fn an_android_static_field_reads_from_the_class_and_a_constructor_constructs() {
		let field = member(json!({
			"name": "TAG", "kind": "fields", "type": "java.lang.String", "static": true, "read": "auto",
		}));
		assert!(
			plugin_code(ExplorerPlatform::Android, "com.discord.Foo", &field)
				.unwrap()
				.ends_with(
					"const value = java.getField(java.getClass('com.discord.Foo'), 'TAG');\n"
				)
		);
		let constructor = member(json!({
			"name": "<init>", "kind": "constructors", "parameters": ["android.content.Context", "java.lang.String"],
			"read": "never",
		}));
		assert!(
			plugin_code(
				ExplorerPlatform::Android,
				"android.widget.TextView",
				&constructor
			)
			.unwrap()
			.ends_with(
				"java.construct('android.widget.TextView', [arg0, { type: 'string', value: '' }]);\n"
			)
		);
	}
}
