package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestLogosDirectivesSurviveProtection(t *testing.T) {
	source := strings.Join([]string{
		"%hook UIFont",
		"+ (UIFont *)fontWithName:(NSString *)name size:(CGFloat)size",
		"{",
		"    NSLog(@\"%orig stays in strings %@\", name);",
		"    return %orig(name, size);",
		"}",
		"%end",
		"",
		"%ctor",
		"{",
		"    %init(Group, Base = %c(DCDBase));",
		"}",
		"",
	}, "\n")

	protected, err := protectLogos([]byte(source))
	if err != nil {
		t.Fatal(err)
	}
	text := string(protected)
	if strings.Contains(text, "\n%hook") || strings.Contains(text, " %orig(") || strings.Contains(text, "%c(") {
		t.Fatalf("Logos syntax was left for clang-format:\n%s", text)
	}
	if !strings.Contains(text, `@"%orig stays in strings %@"`) {
		t.Fatal("string literals must not be rewritten")
	}
	if !strings.Contains(text, logosPragma+"0\n") || !strings.Contains(text, logosPragma+"2\n") {
		t.Fatal("directive lines must become numbered pragmas")
	}

	restored, err := restoreLogos(protected, []byte(source))
	if err != nil {
		t.Fatal(err)
	}
	if string(restored) != source {
		t.Fatalf("restoring changed the source:\n%s", restored)
	}
}

func TestTokenComparisonAllowsWhitespaceAndIncludeOrder(t *testing.T) {
	original := "#import \"B.h\"\n#import \"A.h\"\nint value=1;\n"
	formatted := "#import \"A.h\"\n#import \"B.h\"\n\nint value = 1;\n"
	if !sameTokens([]byte(original), []byte(formatted)) {
		t.Fatal("whitespace and include order changes must be allowed")
	}
	if sameTokens([]byte("int value = 1;"), []byte("int value = 2;")) {
		t.Fatal("token changes must be rejected")
	}
}

func TestProtectionRejectsSourcesUsingPlaceholders(t *testing.T) {
	if _, err := protectLogos([]byte("int _LOrg = 0;")); err == nil {
		t.Fatal("sources that already use a placeholder must be rejected")
	}
}

func TestClangFormatKeepsLogosIntact(t *testing.T) {
	if err := requireClangFormat(); err != nil {
		t.Skip(err)
	}
	if _, err := exec.LookPath("clang-format"); err != nil {
		t.Skip(err)
	}
	source := strings.Join([]string{
		"#import \"Toolbox.h\"",
		"",
		"%hook UIWindow",
		"- (void)becomeKeyWindow",
		"{",
		"    %orig;",
		"    [self   setNeedsLayout];",
		"}",
		"%end",
		"",
		"%hook UIApplication",
		"%new",
		"- (void)handle:(UILongPressGestureRecognizer *)gesture",
		"{",
		"    NSLog(@\"%@\", %c(DCDThemeModule));",
		"}",
		"%end",
		"",
		"%ctor",
		"{",
		"    %init();",
		"}",
		"",
	}, "\n")

	root := loaderRoot(t)
	path := filepath.Join(t.TempDir(), "Sample.x")
	first, err := formatNativeSource(root, path, []byte(source))
	if err != nil {
		t.Fatal(err)
	}
	for _, mangled := range []string{"% hook", "% end", "% new", "% orig", "% ctor", "% init", "% c("} {
		if strings.Contains(string(first), mangled) {
			t.Fatalf("clang-format mangled %q:\n%s", mangled, first)
		}
	}
	if strings.Join(logosDirectives(first), "|") != "%hook UIWindow|%end|%hook UIApplication|%new|%end|%ctor" {
		t.Fatalf("directives changed:\n%s", first)
	}
	if !strings.Contains(string(first), "[self setNeedsLayout];") {
		t.Fatalf("the code itself was not formatted:\n%s", first)
	}

	second, err := formatNativeSource(root, path, first)
	if err != nil {
		t.Fatal(err)
	}
	if string(second) != string(first) {
		t.Fatalf("formatting is not idempotent:\n%s\n---\n%s", first, second)
	}
}
