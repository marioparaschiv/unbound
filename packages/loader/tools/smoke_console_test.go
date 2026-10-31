package main

import (
	"strings"
	"testing"
)

func TestConsoleEntriesFromEachPlatform(t *testing.T) {
	cases := []struct {
		line  string
		parse func(string) (smokeConsoleEntry, bool)
		want  smokeConsoleEntry
		ok    bool
	}{
		{"10-26 21:00:00.000  4242  4243 E ReactNativeJS: TypeError: Cannot read property 'x' of undefined at 12:34", androidConsoleEntry, smokeConsoleEntry{"error", "TypeError: Cannot read property 'x' of undefined at #:#"}, true},
		{"10-26 21:00:00.000  4242  4243 W Unbound : [plugins] unbound.moyai started in 1234 ms", androidConsoleEntry, smokeConsoleEntry{"warning", "[plugins] unbound.moyai started in # ms"}, true},
		{"10-26 21:00:00.000  4242  4243 I ReactNativeJS: hello", androidConsoleEntry, smokeConsoleEntry{}, false},
		{"10-26 21:00:00.000   600   700 E ActivityManager: unrelated", androidConsoleEntry, smokeConsoleEntry{}, false},
		{"2026-10-26 21:00:00.000 E  Discord[4242:1a2b] [app.unbound:JS] Failed to fetch 0xdeadbeef", iosConsoleEntry, smokeConsoleEntry{"error", "Failed to fetch <hex>"}, true},
		{"2026-10-26 21:00:00.000 I  Discord[4242:1a2b] [app.unbound:plugins] Loaded 3 plugins.", iosConsoleEntry, smokeConsoleEntry{}, false},
		{"2026-10-27T21:00:00.123Z W [plugins] slow start for 3f2b9c1e-1111-2222-3333-444455556666", deviceConsoleEntry, smokeConsoleEntry{"warning", "[plugins] slow start for <uuid>"}, true},
		{"2026-10-27T21:00:00.123Z I [plugins] fine", deviceConsoleEntry, smokeConsoleEntry{}, false},
	}
	for _, test := range cases {
		got, ok := test.parse(test.line)
		if ok != test.ok || got != test.want {
			t.Errorf("%q parsed as %+v, %v", test.line, got, ok)
		}
	}
}

func TestConsoleMessagesAreNormalisedAndBounded(t *testing.T) {
	if got := normaliseConsoleMessage("at /data/user/0/com.discord/files/x.js:1   took 0.5s"); got != "at <path> took #s" {
		t.Fatalf("got %q", got)
	}
	if got := normaliseConsoleMessage(strings.Repeat("z", 1000)); len(got) != smokeConsoleMessageLimit {
		t.Fatalf("got %d characters", len(got))
	}
	set := smokeConsoleSet{}
	for index := 0; index < smokeConsoleEntryLimit+50; index++ {
		set.add(smokeConsoleEntry{"error", strings.Repeat("x", index+1)})
	}
	set.add(smokeConsoleEntry{"error", ""})
	if len(set) != smokeConsoleEntryLimit {
		t.Fatalf("kept %d entries", len(set))
	}
}

func TestWatcherRecordsConsoleEntriesOnce(t *testing.T) {
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	watcher.observe("10-26 21:00:00.000  4242  4243 W ReactNativeJS: Requested message 2F5EsD is missing")
	watcher.observe("10-26 21:00:01.000  4242  4243 W ReactNativeJS: Requested message 2F5EsD is missing")
	watcher.observe("10-26 21:00:01.000  4242  4243 E ReactNativeJS: boom")
	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	want := []smokeConsoleEntry{{"error", "boom"}, {"warning", "Requested message #F#EsD is missing"}}
	if len(result.console) != 2 || result.console[0] != want[0] || result.console[1] != want[1] {
		t.Fatalf("recorded %+v", result.console)
	}
	if record := startupRecord(result); !record.Recorded || len(record.Console) != 2 {
		t.Fatalf("startup record %+v", record)
	}
}

func TestConsoleReportFlagsOnlyNewMessages(t *testing.T) {
	known := smokeConsoleEntry{"warning", "known"}
	baseline := []smokeStartupRecord{
		{Recorded: true, Console: []smokeConsoleEntry{known}},
		{Recorded: true},
		{Recorded: true},
		{BundleMs: 1},
	}
	current := smokeStartupRecord{Recorded: true, Console: []smokeConsoleEntry{known, {"error", "new | piped"}}}
	report := renderConsoleReport(current, baseline)
	if len(report.warnings) != 1 || report.warnings[0].title != "New console error" || report.warnings[0].message != "new | piped" {
		t.Fatalf("warnings %+v", report.warnings)
	}
	if !strings.Contains(report.markdown, "none of the last 3 main runs") || !strings.Contains(report.markdown, "`new \\| piped`") {
		t.Fatalf("markdown:\n%s", report.markdown)
	}
	if quiet := renderConsoleReport(smokeStartupRecord{Recorded: true, Console: []smokeConsoleEntry{known}}, baseline); len(quiet.warnings) != 0 || !strings.Contains(quiet.markdown, "No console error") {
		t.Fatalf("quiet report %+v", quiet)
	}
	if early := renderConsoleReport(current, baseline[:2]); len(early.warnings) != 0 || !strings.Contains(early.markdown, "nothing to compare against yet") {
		t.Fatalf("early report %+v", early)
	}
}
