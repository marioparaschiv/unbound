package main

import (
	"bufio"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"
)

type smokeLogWatcher struct {
	target     smokeTarget
	mu         sync.Mutex
	loaded     map[string]bool
	count      int
	failures   map[string][]string
	crashes    []string
	reloads    int
	reloadExit bool
	launchedAt time.Time
	runtimeAt  time.Time
	startup    smokeStartupTimes
	console    smokeConsoleSet
	now        func() time.Time
}

func newSmokeLogWatcher(target smokeTarget) *smokeLogWatcher {
	return &smokeLogWatcher{target: target, loaded: map[string]bool{}, failures: map[string][]string{}, console: smokeConsoleSet{}, now: time.Now}
}

func (watcher *smokeLogWatcher) consume(logs io.Reader, sink io.Writer) {
	scanner := bufio.NewScanner(logs)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Fprintln(sink, line)
		watcher.observe(line)
	}
}

func (watcher *smokeLogWatcher) observe(line string) {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	if watcher.target.isCrashLine(line) {
		if watcher.reloadExit {
			watcher.reloadExit = false
		} else {
			watcher.crashes = append(watcher.crashes, strings.TrimSpace(line))
		}
	}
	if entry, ok := watcher.target.consoleEntry(line); ok {
		watcher.console.add(entry)
	}
	if match := smokeAddonFailure.FindStringSubmatch(line); match != nil {
		watcher.failures[match[1]] = append(watcher.failures[match[1]], strings.TrimSpace(line))
	}
	if !watcher.target.isLoaderLine(line) {
		return
	}
	if strings.Contains(line, smokeRuntimeCreated) {
		watcher.markRuntime()
	}
	if strings.Contains(line, smokeReloading) {
		// The runtime that runs Unbound loads every plugin again; the first exit after this is the planned restart.
		watcher.loaded = map[string]bool{}
		watcher.count = 0
		watcher.reloads++
		watcher.reloadExit = true
	}
	if strings.Contains(line, smokeBundleExecuted) {
		watcher.recordMilestone(&watcher.startup.bundle)
	}
	if match := smokeLoadedCount.FindStringSubmatch(line); match != nil {
		watcher.count, _ = strconv.Atoi(match[1])
		watcher.recordMilestone(&watcher.startup.plugins)
		return
	}
	if index := strings.Index(line, "Loaded "); index >= 0 {
		rest := line[index+len("Loaded "):]
		if end := strings.Index(rest, " from "); end > 0 {
			watcher.loaded[rest[:end]] = true
		}
	}
}

func (watcher *smokeLogWatcher) loadedAll(plugins []smokePlugin) bool {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	if watcher.count < len(plugins) {
		return false
	}
	for _, plugin := range plugins {
		if !watcher.loaded[plugin.id] {
			return false
		}
	}
	return true
}

func (watcher *smokeLogWatcher) recordCrash(reason string) {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	watcher.crashes = append(watcher.crashes, reason)
}

func (watcher *smokeLogWatcher) observeFailures(line string) {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	if match := smokeAddonFailure.FindStringSubmatch(line); match != nil {
		watcher.failures[match[1]] = append(watcher.failures[match[1]], strings.TrimSpace(line))
	}
}

func (watcher *smokeLogWatcher) takeReload() bool {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	if watcher.reloads == 0 {
		return false
	}
	watcher.reloads--
	return true
}

func (watcher *smokeLogWatcher) takeCrashBeforeLoads() string {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	if len(watcher.crashes) == 0 {
		return ""
	}
	crash := watcher.crashes[0]
	watcher.crashes = nil
	watcher.loaded = map[string]bool{}
	watcher.count = 0
	watcher.startup = smokeStartupTimes{}
	return crash
}

func (watcher *smokeLogWatcher) crashed() bool {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	return len(watcher.crashes) > 0
}

func (watcher *smokeLogWatcher) snapshot(result *smokeResult) {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	for id := range watcher.loaded {
		result.loaded[id] = true
	}
	result.count = watcher.count
	result.startup = watcher.startup
	for id, lines := range watcher.failures {
		result.failures[id] = append([]string(nil), lines...)
	}
	result.crashes = append([]string(nil), watcher.crashes...)
	result.console = watcher.console.sorted()
}
