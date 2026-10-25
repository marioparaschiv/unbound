package main

import (
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
	if !strings.Contains(text, logosPragma+"%hook UIFont") {
		t.Fatal("directive lines must become pragmas")
	}

	if restored := string(restoreLogos(protected)); restored != source {
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
	if _, err := protectLogos([]byte("int __unbound_logos_orig = 0;")); err == nil {
		t.Fatal("sources that already use a placeholder must be rejected")
	}
}
