package main

import "testing"

func TestDeviceLogTextReadsJSONAndPlainLines(t *testing.T) {
	cases := []struct{ line, want string }{
		{`{"t":1793134800123,"src":"unbound","lvl":"warn","scope":["Loader","plugins"],"msg":"slow start"}`, "2026-10-27T21:00:00.123Z W [plugins] slow start"},
		{`{"t":1793134800123,"src":"js","lvl":"error","scope":[],"msg":"'boom'"}`, "2026-10-27T21:00:00.123Z E [console] 'boom'"},
		{`{"t":1793134800123,"src":"unbound","lvl":"info","scope":["Core"],"msg":"Unbound initialized"}`, "2026-10-27T21:00:00.123Z I [console] [Core] Unbound initialized"},
		{`{"t":1793134800123,"src":"native","lvl":"debug","scope":[],"msg":"stderr"}`, "2026-10-27T21:00:00.123Z D [native] stderr"},
		{"2026-10-27T21:00:00.123Z I [plugins] Loaded 3 plugins.", "2026-10-27T21:00:00.123Z I [plugins] Loaded 3 plugins."},
		{`{"t":1793134800123,"src":"js","lvl":"inf`, `{"t":1793134800123,"src":"js","lvl":"inf`},
	}
	for _, test := range cases {
		if got := deviceLogText(test.line); got != test.want {
			t.Errorf("%q rendered as %q, want %q", test.line, got, test.want)
		}
	}
}

func TestDeviceLogChunkFeedsTheConsoleChecks(t *testing.T) {
	chunk := deviceLogChunk(`{"t":1793134800123,"src":"unbound","lvl":"warn","scope":["Loader","plugins"],"msg":"slow start\nmore"}` + "\n")
	if chunk != "2026-10-27T21:00:00.123Z W [plugins] slow start\nmore\n" {
		t.Fatalf("got %q", chunk)
	}
	entry, ok := deviceConsoleEntry("2026-10-27T21:00:00.123Z W [plugins] slow start")
	if !ok || entry != (smokeConsoleEntry{"warning", "[plugins] slow start"}) {
		t.Fatalf("got %+v, %v", entry, ok)
	}
}
