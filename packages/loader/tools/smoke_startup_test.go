package main

import (
	"strings"
	"testing"
	"time"
)

func TestSmokeLogWatcherTimesStartupFromLaunch(t *testing.T) {
	clock := time.Date(2026, 10, 27, 21, 0, 0, 0, time.UTC)
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	watcher.now = func() time.Time { return clock }
	watcher.observe("10-27 21:00:00.000  4242  4242 I astral : [default] astral's bundle was successfully executed.")
	watcher.markLaunch()
	clock = clock.Add(4 * time.Second)
	watcher.observe("10-27 21:00:04.000  4242  4242 I astral : [default] astral's bundle was successfully executed.")
	clock = clock.Add(3 * time.Second)
	watcher.observe("10-27 21:00:07.000  4242  4242 I astral : [plugins] Loaded 2 plugins.")
	clock = clock.Add(time.Minute)
	watcher.observe("10-27 21:01:07.000  4242  4242 I astral : [plugins] Loaded 2 plugins.")
	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	if result.startup.bundle != 4*time.Second || result.startup.plugins != 7*time.Second {
		t.Fatalf("milestones should be timed from launch and keep the first sighting, got %+v", result.startup)
	}
}

func TestSmokeLogWatcherRestartsStartupTimesOnRelaunch(t *testing.T) {
	clock := time.Date(2026, 10, 27, 21, 0, 0, 0, time.UTC)
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	watcher.now = func() time.Time { return clock }
	watcher.markLaunch()
	clock = clock.Add(5 * time.Second)
	watcher.observe("I astral : [default] astral's bundle was successfully executed.")
	watcher.recordCrash("boom")
	watcher.takeCrashBeforeLoads()
	clock = clock.Add(20 * time.Second)
	watcher.markLaunch()
	clock = clock.Add(2 * time.Second)
	watcher.observe("I astral : [default] astral's bundle was successfully executed.")
	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	if result.startup.bundle != 2*time.Second {
		t.Fatalf("relaunch should time the second launch only, got %s", result.startup.bundle)
	}
}

func TestStartupBudgetProblems(t *testing.T) {
	budget := smokeStartupBudget{bundle: 30 * time.Second, plugins: time.Minute}
	if problems := startupBudgetProblems(smokeStartupTimes{bundle: 10 * time.Second, plugins: 50 * time.Second}, budget, nil); len(problems) != 0 {
		t.Fatalf("within budget should pass, got %v", problems)
	}
	problems := startupBudgetProblems(smokeStartupTimes{bundle: 45 * time.Second}, budget, nil)
	if len(problems) != 2 || !strings.Contains(problems[0], "over its 30s budget") || !strings.Contains(problems[1], "never reached loading every plugin") {
		t.Fatalf("unexpected problems %v", problems)
	}
	if problems := startupBudgetProblems(smokeStartupTimes{}, budget, []string{"crash"}); len(problems) != 0 {
		t.Fatalf("a crash is already reported on its own, got %v", problems)
	}
	if problems := startupBudgetProblems(smokeStartupTimes{bundle: time.Hour}, smokeStartupBudget{}, nil); len(problems) != 0 {
		t.Fatalf("no budget only reports, got %v", problems)
	}
}

func TestRenderSmokeReportShowsStartupTimes(t *testing.T) {
	result := &smokeResult{platform: "android", loaded: map[string]bool{}, startup: smokeStartupTimes{bundle: 4230 * time.Millisecond}, budget: smokeStartupBudget{plugins: time.Minute}}
	report := renderSmokeReport(result)
	if !strings.Contains(report, "| astral's bundle executed | 4.2s after launch | none |") || !strings.Contains(report, "| Every plugin loaded | not reached | 1m0s |") {
		t.Fatalf("startup table missing from report:\n%s", report)
	}
}

func TestRenderSlowestStartsListsTheSlowestFirst(t *testing.T) {
	ms := func(value float64) *float64 { return &value }
	statuses := []smokePluginStatus{
		{ID: "astral.a", StartMs: ms(3)},
		{ID: "astral.b", StartMs: ms(120)},
		{ID: "astral.c"},
		{ID: "astral.d", StartMs: ms(40)},
	}
	got := renderSlowestStarts(statuses)
	if !strings.Contains(got, "163 ms to start in total") || !strings.Contains(got, "Slowest: `astral.b` 120 ms, `astral.d` 40 ms, `astral.a` 3 ms.") {
		t.Fatalf("unexpected summary %q", got)
	}
	if renderSlowestStarts([]smokePluginStatus{{ID: "astral.c"}}) != "" {
		t.Fatal("an older client without timings adds no summary")
	}
	if describeStartMs(nil) != "—" || describeStartMs(ms(12.4)) != "12 ms" {
		t.Fatal("unexpected start cell")
	}
}

func TestPluginStartBudgetFlagsSlowPlugins(t *testing.T) {
	ms := func(value float64) *float64 { return &value }
	statuses := []smokePluginStatus{{ID: "astral.fast", StartMs: ms(40)}, {ID: "astral.slow", StartMs: ms(1200)}, {ID: "astral.untimed"}}
	problems := pluginStartBudgetProblems(statuses, time.Second)
	if len(problems) != 1 || !strings.Contains(problems[0], "astral.slow took 1200 ms to start, over the 1s plugin start budget") {
		t.Fatalf("unexpected problems %v", problems)
	}
	if pluginStartBudgetProblems(statuses, 0) != nil {
		t.Fatal("no budget only reports")
	}
}

func TestSmokeLogWatcherTimesAstralFromDiscordsRuntime(t *testing.T) {
	clock := time.Date(2026, 10, 28, 19, 0, 0, 0, time.UTC)
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	watcher.now = func() time.Time { return clock }
	watcher.markLaunch()
	clock = clock.Add(5 * time.Minute)
	watcher.observe("I astral : [runtime] Metro module capture installed before Discord bundle.")
	clock = clock.Add(4 * time.Second)
	watcher.observe("I astral : [default] astral's bundle was successfully executed.")
	clock = clock.Add(time.Second)
	watcher.observe("I astral : [plugins] Loaded 2 plugins.")
	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	want := smokeStartupTimes{runtime: 5 * time.Minute, bundle: 4 * time.Second, plugins: 5 * time.Second}
	if result.startup != want {
		t.Fatalf("astral's milestones should start when Discord's runtime does, got %+v, want %+v", result.startup, want)
	}
	if problems := startupBudgetProblems(result.startup, smokeStartupBudget{bundle: time.Minute, plugins: time.Minute}, nil); len(problems) != 0 {
		t.Fatalf("Discord's own launch time counted against astral's budget: %v", problems)
	}
}

func TestSmokeLogWatcherCountsAMilestoneReachedWithTheRuntime(t *testing.T) {
	clock := time.Date(2026, 10, 28, 19, 0, 0, 0, time.UTC)
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	watcher.now = func() time.Time { return clock }
	watcher.markLaunch()
	clock = clock.Add(time.Minute)
	watcher.observe("I astral : [runtime] Metro module capture installed before Discord bundle.")
	watcher.observe("I astral : [plugins] Loaded 2 plugins.")
	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	if problems := startupBudgetProblems(result.startup, smokeStartupBudget{plugins: time.Second}, nil); len(problems) != 0 {
		t.Fatalf("plugins loaded in the same instant as the runtime were reported as missing: %v", problems)
	}
}
