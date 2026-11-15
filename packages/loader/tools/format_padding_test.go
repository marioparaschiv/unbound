package main

import (
	"strings"
	"testing"
)

func TestPadBlocksSeparatesABlockFromTheNextStatement(t *testing.T) {
	source := strings.Join([]string{
		"int run()",
		"{",
		"    if (ready)",
		"    {",
		"        start();",
		"    }",
		"    return 0;",
		"}",
		"",
	}, "\n")
	padded := string(padBlocks([]byte(source)))
	if !strings.Contains(padded, "    }\n\n    return 0;") {
		t.Fatalf("expected a blank line after the block:\n%s", padded)
	}
	if string(padBlocks([]byte(padded))) != padded {
		t.Fatal("padding must be idempotent")
	}
}

func TestPadBlocksLeavesContinuationsJoined(t *testing.T) {
	source := strings.Join([]string{
		"    if (a)",
		"    {",
		"    }",
		"    else",
		"    {",
		"    }",
		"    catch (...)",
		"    do",
		"    {",
		"    }",
		"    while (b);",
		"        }",
		"    }",
		"    }",
		"    case 2:",
		"    }",
		"    #endif",
		"    }",
		"    );",
	}, "\n")
	if padded := string(padBlocks([]byte(source))); padded != source {
		t.Fatalf("continuations and deeper lines must stay joined:\n%s", padded)
	}
}

func TestPadBlocksSkipsRawStringsCommentsAndDisabledRegions(t *testing.T) {
	source := strings.Join([]string{
		"// clang-format off",
		"    }",
		"    run();",
		"}",
		"// clang-format on",
		`const char *script = R"JS((function () {`,
		"    if (a) {",
		"    }",
		"    run();",
		`})())JS";`,
		"/* example:",
		"    }",
		"    run();",
		"*/",
		"",
	}, "\n")
	if padded := string(padBlocks([]byte(source))); padded != source {
		t.Fatalf("raw strings, comments and disabled regions must not change:\n%s", padded)
	}
}
