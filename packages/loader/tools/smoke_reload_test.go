package main

import (
	"context"
	"testing"
	"time"
)

// Lines from the Loader Build Unbound run 41288382310 for e84491bfa, a fresh install with no saved
// bundle. The runtime line sits where the loader now logs it, before addons load for that runtime.
var androidFirstLaunchLog = []string{
	"11-01 08:28:49.463  4818  5025 I Unbound : [runtime] Loading ReactInstance 11278778 through loadJSBundle",
	"11-01 08:28:49.463  4818  5025 I Unbound : [runtime] Discord's runtime was created.",
	"11-01 08:28:49.762  4818  5025 I Unbound : [plugins] Loaded unbound.view-raw from /data/user/0/com.discord/files/Unbound/Plugins/unbound.view-raw/index.js.",
	"11-01 08:28:49.763  4818  5025 I Unbound : [plugins] Loaded 39 plugins.",
	"11-01 08:28:49.768  4818  5037 I Unbound : [default] No saved bundle to run before Discord's bundle; Unbound runs once it downloads.",
	"11-01 08:28:50.033  4818  5054 I Unbound : [default] Downloaded a new bundle; reloading to run it before Discord's bundle.",
	"11-01 08:28:51.070   523  1729 I ActivityManager: Process com.discord (pid 4818) has died: fg  TOP ",
	"11-01 08:28:55.435  5086  5266 I Unbound : [runtime] Loading ReactInstance 229656960 through loadJSBundle",
	"11-01 08:28:55.435  5086  5266 I Unbound : [runtime] Discord's runtime was created.",
	"11-01 08:28:55.785  5086  5266 I Unbound : [plugins] Loaded unbound.view-raw from /data/user/0/com.discord/files/Unbound/Plugins/unbound.view-raw/index.js.",
	"11-01 08:28:55.785  5086  5266 I Unbound : [plugins] Loaded 39 plugins.",
	"11-01 08:28:56.676  5086  5269 I Unbound : [default] Unbound's bundle was successfully executed.",
}

var iosFirstLaunchLog = []string{
	"2026-11-01 08:44:08.927 I  Discord[10607:15c36] [app.unbound:default] RCTHost didInitializeRuntime reached.",
	"2026-11-01 08:44:08.927 I  Discord[10607:15c36] [app.unbound:runtime] Discord's runtime was created.",
	"2026-11-01 08:44:09.055 I  Discord[10607:15c36] [app.unbound:plugins] Loaded unbound.view-raw from /Documents/Unbound/Plugins/unbound.view-raw/index.js.",
	"2026-11-01 08:44:09.055 I  Discord[10607:15c36] [app.unbound:plugins] Loaded 39 plugins.",
	"2026-11-01 08:44:11.778 I  Discord[10607:15c36] [app.unbound:default] Downloaded a new bundle; reloading to run it before Discord's bundle.",
	"2026-11-01 08:44:13.122 I  Discord[10607:1831c] [app.unbound:default] RCTHost didInitializeRuntime reached.",
	"2026-11-01 08:44:13.122 I  Discord[10607:1831c] [app.unbound:runtime] Discord's runtime was created.",
	"2026-11-01 08:44:13.206 I  Discord[10607:1831c] [app.unbound:plugins] Loaded unbound.view-raw from /Documents/Unbound/Plugins/unbound.view-raw/index.js.",
	"2026-11-01 08:44:13.207 I  Discord[10607:1831c] [app.unbound:plugins] Loaded 39 plugins.",
	"2026-11-01 08:44:15.214 I  Discord[10607:183e8] [app.unbound:default] Unbound's bundle was successfully executed.",
}

var reloadSmokePlugins = []smokePlugin{{id: "unbound.view-raw"}}

// replaySmokeLog observes each line at the time it was logged.
func replaySmokeLog(t *testing.T, watcher *smokeLogWatcher, layout string, lines []string) {
	t.Helper()
	for _, line := range lines {
		at, err := time.Parse(layout, line[:len(layout)])
		if err != nil {
			t.Fatalf("unreadable log time in %q: %v", line, err)
		}
		watcher.now = func() time.Time { return at }
		watcher.observe(line)
	}
}

func launchedAt(t *testing.T, watcher *smokeLogWatcher, layout, value string) {
	t.Helper()
	at, err := time.Parse(layout, value)
	if err != nil {
		t.Fatal(err)
	}
	watcher.now = func() time.Time { return at }
	watcher.markLaunch()
}

const (
	androidLogTime = "01-02 15:04:05.000"
	iosLogTime     = "2006-01-02 15:04:05.000"
)

func TestSmokeWaitsForTheRuntimeAfterTheLoadersFirstLaunchRestart(t *testing.T) {
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	launchedAt(t, watcher, androidLogTime, "11-01 08:28:43.370")

	replaySmokeLog(t, watcher, androidLogTime, androidFirstLaunchLog[:6])
	if watcher.loadedAll(reloadSmokePlugins) {
		t.Fatal("plugins loaded by the runtime the loader is about to restart counted as the run's loads")
	}
	replaySmokeLog(t, watcher, androidLogTime, androidFirstLaunchLog[6:7])
	if watcher.crashed() {
		t.Fatal("the loader's planned restart was reported as a crash")
	}
	replaySmokeLog(t, watcher, androidLogTime, androidFirstLaunchLog[7:])
	if !watcher.loadedAll(reloadSmokePlugins) {
		t.Fatal("the relaunched Discord's plugin loads were not counted")
	}

	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	want := smokeStartupTimes{runtime: 6093 * time.Millisecond, plugins: 300 * time.Millisecond, bundle: 7213 * time.Millisecond}
	if result.startup != want {
		t.Fatalf("got startup %+v, want %+v", result.startup, want)
	}
	if len(result.crashes) != 0 {
		t.Fatalf("a first launch that restarted once reported crashes: %v", result.crashes)
	}
	if problems := startupBudgetProblems(result.startup, smokeStartupBudget{bundle: 30 * time.Second, plugins: 20 * time.Second}, nil); len(problems) != 0 {
		t.Fatalf("a first launch that restarted once went over budget: %v", problems)
	}
}

func TestSmokeCountsACrashAfterThePlannedRestart(t *testing.T) {
	watcher := newSmokeLogWatcher(&androidSmokeTarget{})
	launchedAt(t, watcher, androidLogTime, "11-01 08:28:43.370")
	replaySmokeLog(t, watcher, androidLogTime, androidFirstLaunchLog[:7])
	watcher.observe("11-01 08:28:57.000   523  1729 I ActivityManager: Process com.discord (pid 5086) has died: fg  TOP ")
	if !watcher.crashed() {
		t.Fatal("the relaunched Discord dying was not reported as a crash")
	}
}

type restartingSmokeTarget struct {
	*androidSmokeTarget
	alive    bool
	attaches int
}

func (target *restartingSmokeTarget) running(context.Context) bool { return target.alive }

func (target *restartingSmokeTarget) attach(context.Context) error {
	target.attaches++
	target.alive = true
	return nil
}

func TestSmokeFollowsOnlyAnAnnouncedRestart(t *testing.T) {
	target := &restartingSmokeTarget{androidSmokeTarget: &androidSmokeTarget{}}
	watcher := newSmokeLogWatcher(target)
	if discordRunning(context.Background(), target, watcher) {
		t.Fatal("an exit with no announced reload was followed")
	}
	watcher.observe(androidFirstLaunchLog[5])
	if !discordRunning(context.Background(), target, watcher) || target.attaches != 1 {
		t.Fatalf("the announced restart was not followed, %d attaches", target.attaches)
	}
	target.alive = false
	if discordRunning(context.Background(), target, watcher) {
		t.Fatal("a second exit was followed as the same restart")
	}
}

func TestSmokeTimesAFirstLaunchThatReloadsInPlace(t *testing.T) {
	watcher := newSmokeLogWatcher(&iosSmokeTarget{})
	launchedAt(t, watcher, iosLogTime, "2026-11-01 08:33:58.827")

	replaySmokeLog(t, watcher, iosLogTime, iosFirstLaunchLog[:5])
	if watcher.loadedAll(reloadSmokePlugins) {
		t.Fatal("plugins loaded by the runtime the loader is about to reload counted as the run's loads")
	}
	replaySmokeLog(t, watcher, iosLogTime, iosFirstLaunchLog[5:])

	result := &smokeResult{loaded: map[string]bool{}, failures: map[string][]string{}}
	watcher.snapshot(result)
	want := smokeStartupTimes{runtime: 10*time.Minute + 10100*time.Millisecond, plugins: 128 * time.Millisecond, bundle: 6287 * time.Millisecond}
	if result.startup != want {
		t.Fatalf("got startup %+v, want %+v", result.startup, want)
	}
	if problems := startupBudgetProblems(result.startup, smokeStartupBudget{bundle: time.Minute, plugins: time.Minute}, nil); len(problems) != 0 {
		t.Fatalf("Discord's own wait before its runtime counted against Unbound: %v", problems)
	}
}
