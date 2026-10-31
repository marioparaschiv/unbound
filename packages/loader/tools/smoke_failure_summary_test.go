package main

import (
	"strings"
	"testing"
)

const failedReport = "## Android smoke test\n\nFailed:\n\n- Discord crashed: Process com.discord has died\n- debugger check: Discord exited before the debugger connected\n\n| Startup milestone | Time |\n"

func TestSmokeFailureSummaryListsFailuresAndTheFirstCrash(t *testing.T) {
	log := "10-30 I boot\n" + strings.Repeat("10-30 I filler\n", 12) + "10-30 W System.err: at NativeProxy.initHybrid\n10-30 F libc: Fatal signal 7 (SIGBUS)\n10-30 F DEBUG: backtrace:\n10-30 I later\n"
	summary := renderSmokeFailureSummary(failedReport, log)
	for _, want := range []string{
		"- Discord crashed: Process com.discord has died",
		"- debugger check: Discord exited before the debugger connected",
		"Fatal signal 7 (SIGBUS)",
		"DEBUG: backtrace:",
		"System.err: at NativeProxy.initHybrid",
	} {
		if !strings.Contains(summary, want) {
			t.Fatalf("summary is missing %q:\n%s", want, summary)
		}
	}
	if strings.Contains(summary, "I boot") || strings.Contains(summary, "Startup milestone") {
		t.Fatalf("summary includes lines long before the crash or the startup table:\n%s", summary)
	}
}

func TestSmokeFailureSummaryIsEmptyForAPassingRun(t *testing.T) {
	if summary := renderSmokeFailureSummary("## Android smoke test\n\nPassed.\n", "Fatal signal 11"); summary != "" {
		t.Fatalf("a passing run produced %q", summary)
	}
}

func TestSmokeFailureSummaryCapsTheCrashExcerpt(t *testing.T) {
	log := "FATAL EXCEPTION: main\n" + strings.Repeat("at frame\n", 50)
	if got := len(crashExcerpt(log)); got != crashExcerptLimit {
		t.Fatalf("excerpt has %d lines, want %d", got, crashExcerptLimit)
	}
}
