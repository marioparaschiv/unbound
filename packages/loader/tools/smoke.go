package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const smokePollInterval = 2 * time.Second

var (
	smokePluginID         = regexp.MustCompile(`^[\w.-]+$`)
	smokeLoadedCount      = regexp.MustCompile(`Loaded (\d+) plugins?\.`)
	smokeAddonFailure     = regexp.MustCompile(`Failed to (?:start|load) addon ([\w.-]+)`)
	errSmokeNotConnected  = errors.New("no device is connected to the debugger bridge")
	smokeStatusExpression = `(function () {
	var manager = unbound.plugins;
	var entities = manager.getEntities();
	var statuses = [];
	for (var index = 0; index < entities.length; index++) {
		var entity = entities[index];
		if (!entity.started && !entity.failed) {
			manager.enable(entity.id);
		}
		var error = manager.errors.get(entity.id);
		statuses.push({
			id: entity.id,
			started: Boolean(entity.started),
			failed: Boolean(entity.failed),
			error: error ? String(error && error.message ? error.message : error) : ''
		});
	}
	return JSON.stringify(statuses);
})()`
)

type smokeOptions struct {
	repository string
	plugins    string
	client     string
	artifacts  string
	summary    string
	timeout    time.Duration
	bridgePort int
	bundlePort int
}

type smokePlugin struct {
	id        string
	directory string
	files     []string
}

type smokePluginStatus struct {
	ID      string `json:"id"`
	Started bool   `json:"started"`
	Failed  bool   `json:"failed"`
	Error   string `json:"error"`
}

type smokeTarget interface {
	name() string
	hostAddress() string
	prepare(ctx context.Context, plugins []smokePlugin, settings []byte) error
	streamLogs(ctx context.Context) (io.ReadCloser, func() error, error)
	launch(ctx context.Context) error
	running(ctx context.Context) bool
	isLoaderLine(line string) bool
	isCrashLine(line string) bool
	collect(ctx context.Context, artifacts string)
}

type smokeResult struct {
	platform  string
	plugins   []smokePlugin
	loaded    map[string]bool
	count     int
	failures  map[string][]string
	crashes   []string
	statuses  []smokePluginStatus
	evalError string
	problems  []string
}

func runSmoke(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: smoke <android|ios> [flags]")
	}
	switch args[0] {
	case "android":
		return runAndroidSmoke(args[1:])
	case "ios":
		return runIOSSmoke(args[1:])
	default:
		return fmt.Errorf("unknown smoke platform %q", args[0])
	}
}

func registerSmokeFlags(set *flag.FlagSet) *smokeOptions {
	options := &smokeOptions{}
	set.StringVar(&options.repository, "repository", "../..", "repository root, for the debugger bridge and the CLI")
	set.StringVar(&options.plugins, "plugins", "../plugins", "directory of first-party plugins, each built into <plugin>/dist")
	set.StringVar(&options.client, "client", "", "built client directory to serve as the bundle; empty keeps the default bundle URL")
	set.StringVar(&options.artifacts, "artifacts", "smoke-artifacts", "directory for logs, screenshots and the report")
	set.StringVar(&options.summary, "summary", os.Getenv("GITHUB_STEP_SUMMARY"), "markdown file to append the report to")
	set.DurationVar(&options.timeout, "timeout", 10*time.Minute, "how long the app gets to load every plugin and answer the debugger")
	set.IntVar(&options.bridgePort, "bridge-port", 9090, "port of the debugger bridge")
	set.IntVar(&options.bundlePort, "bundle-port", 3000, "port the built client is served on")
	return options
}

func discoverSmokePlugins(directory, platform string) ([]smokePlugin, error) {
	manifests, err := filepath.Glob(filepath.Join(directory, "*", "dist", "manifest.json"))
	if err != nil {
		return nil, err
	}
	var plugins []smokePlugin
	for _, manifestPath := range manifests {
		data, err := os.ReadFile(manifestPath)
		if err != nil {
			return nil, err
		}
		var manifest struct {
			ID        string   `json:"id"`
			Main      string   `json:"main"`
			Platforms []string `json:"platforms"`
		}
		if err := json.Unmarshal(data, &manifest); err != nil {
			return nil, fmt.Errorf("%s: %w", manifestPath, err)
		}
		if !smokePluginID.MatchString(manifest.ID) {
			return nil, fmt.Errorf("%s has an unusable plugin id %q", manifestPath, manifest.ID)
		}
		if len(manifest.Platforms) > 0 && !slices.Contains(manifest.Platforms, platform) {
			continue
		}
		dist := filepath.Dir(manifestPath)
		if manifest.Main == "" {
			return nil, fmt.Errorf("%s has no main entry", manifestPath)
		}
		if _, err := os.Stat(filepath.Join(dist, manifest.Main)); err != nil {
			return nil, fmt.Errorf("%s is not built: %w", manifest.ID, err)
		}
		entries, err := os.ReadDir(dist)
		if err != nil {
			return nil, err
		}
		plugin := smokePlugin{id: manifest.ID, directory: dist}
		for _, entry := range entries {
			if entry.Type().IsRegular() {
				plugin.files = append(plugin.files, entry.Name())
			}
		}
		plugins = append(plugins, plugin)
	}
	if len(plugins) == 0 {
		return nil, fmt.Errorf("%s has no built %s plugins; run bun run plugins:build first", directory, platform)
	}
	sort.Slice(plugins, func(i, j int) bool { return plugins[i].id < plugins[j].id })
	return plugins, nil
}

func smokeSettings(plugins []smokePlugin, debuggerAddress, bundleURL string) ([]byte, error) {
	states := map[string]bool{}
	for _, plugin := range plugins {
		states[plugin.id] = true
	}
	unbound := map[string]any{
		"debugger": map[string]any{"enabled": true, "address": debuggerAddress},
	}
	if bundleURL != "" {
		unbound["loader"] = map[string]any{"update": map[string]any{"url": bundleURL}}
	}
	return json.MarshalIndent(map[string]any{
		"unbound": unbound,
		"plugins": map[string]any{"states": states},
	}, "", "\t")
}

func unsupportedDiscordReason(repository, platform, version string) (string, error) {
	policy, err := loadCompatPolicy(repository)
	if err != nil {
		return "", err
	}
	minimum := policy.Minimum[platform]
	order, err := compareDiscordVersions(version, minimum)
	if err != nil {
		return "", fmt.Errorf("read the Discord version of the build: %w", err)
	}
	if order >= 0 {
		return "", nil
	}
	return fmt.Sprintf("Skipped: this build patches Discord %s, older than %s, the oldest %s version Unbound supports (compat-policy.json), so the loader is not expected to inject into it. Builds of a supported Discord, such as main pushes and releases, run the smoke test.", version, minimum, platform), nil
}

func skipSmokeTest(platform string, options *smokeOptions, reason string) error {
	if err := os.MkdirAll(options.artifacts, 0o755); err != nil {
		return err
	}
	title := map[string]string{"android": "Android", "ios": "iOS"}[platform]
	report := fmt.Sprintf("## %s smoke test\n\n%s\n\n", title, reason)
	fmt.Print(report)
	_ = os.WriteFile(filepath.Join(options.artifacts, "report.md"), []byte(report), 0o644)
	if options.summary != "" {
		if file, err := os.OpenFile(options.summary, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
			defer file.Close()
			_, _ = file.WriteString(report)
		}
	}
	return nil
}

func runSmokeTest(ctx context.Context, platform string, options *smokeOptions, target smokeTarget) error {
	if err := os.MkdirAll(options.artifacts, 0o755); err != nil {
		return err
	}
	plugins, err := discoverSmokePlugins(options.plugins, platform)
	if err != nil {
		return err
	}
	result := &smokeResult{platform: platform, plugins: plugins, loaded: map[string]bool{}, failures: map[string][]string{}}
	defer func() {
		target.collect(context.Background(), options.artifacts)
		writeSmokeReport(result, options)
	}()

	bundleURL := ""
	if options.client != "" {
		server, err := serveSmokeBundle(options.client, options.bundlePort, filepath.Join(options.artifacts, "bundle-requests.txt"))
		if err != nil {
			return err
		}
		defer server.Close()
		bundleURL = fmt.Sprintf("http://%s:%d/", target.hostAddress(), options.bundlePort)
	}
	bridge, err := startSmokeBridge(options.repository, options.bridgePort, filepath.Join(options.artifacts, "debugger-bridge.txt"))
	if err != nil {
		return err
	}
	defer stopSmokeProcess(bridge)

	settings, err := smokeSettings(plugins, fmt.Sprintf("%s:%d", target.hostAddress(), options.bridgePort), bundleURL)
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(options.artifacts, "settings.json"), settings, 0o644); err != nil {
		return err
	}
	if err := target.prepare(ctx, plugins, settings); err != nil {
		return result.fail(fmt.Errorf("prepare %s: %w", target.name(), err))
	}

	logs, stopLogs, err := target.streamLogs(ctx)
	if err != nil {
		return result.fail(fmt.Errorf("stream %s logs: %w", target.name(), err))
	}
	defer stopLogs()
	logFile, err := os.Create(filepath.Join(options.artifacts, platform+"-log.txt"))
	if err != nil {
		return err
	}
	defer logFile.Close()
	watcher := newSmokeLogWatcher(target)
	go watcher.consume(logs, logFile)

	if err := target.launch(ctx); err != nil {
		return result.fail(fmt.Errorf("launch Discord: %w", err))
	}
	deadline := time.Now().Add(options.timeout)
	waitForSmokeLoads(ctx, target, watcher, plugins, deadline)
	var statuses []smokePluginStatus
	var evalErr error
	if watcher.crashed() {
		evalErr = errors.New("skipped because Discord crashed")
	} else {
		statuses, evalErr = evaluateSmokeStatuses(ctx, target, options, deadline)
	}
	settle := time.Now().Add(5 * time.Second)
	for time.Now().Before(settle) && ctx.Err() == nil {
		time.Sleep(time.Second)
	}
	if bridgeLog, err := os.ReadFile(filepath.Join(options.artifacts, "debugger-bridge.txt")); err == nil {
		for _, line := range strings.Split(string(bridgeLog), "\n") {
			watcher.observeFailures(line)
		}
	}
	watcher.snapshot(result)
	result.statuses = statuses
	if evalErr != nil {
		result.evalError = evalErr.Error()
	}
	result.problems = smokeProblems(result)
	if len(result.problems) > 0 {
		return fmt.Errorf("%s smoke test failed:\n- %s", platform, strings.Join(result.problems, "\n- "))
	}
	return nil
}

func (result *smokeResult) fail(err error) error {
	result.problems = append(result.problems, err.Error())
	return err
}

func waitForSmokeLoads(ctx context.Context, target smokeTarget, watcher *smokeLogWatcher, plugins []smokePlugin, deadline time.Time) {
	for time.Now().Before(deadline) && ctx.Err() == nil {
		if watcher.loadedAll(plugins) || watcher.crashed() {
			return
		}
		if !target.running(ctx) {
			watcher.recordCrash("Discord exited before the loader logged every plugin")
			return
		}
		time.Sleep(smokePollInterval)
	}
}

func evaluateSmokeStatuses(ctx context.Context, target smokeTarget, options *smokeOptions, deadline time.Time) ([]smokePluginStatus, error) {
	lastErr := errSmokeNotConnected
	for time.Now().Before(deadline) && ctx.Err() == nil {
		if !target.running(ctx) {
			return nil, errors.New("Discord exited before the debugger connected")
		}
		statuses, err := evaluateSmokeStatusesOnce(ctx, options)
		if err == nil {
			return statuses, nil
		}
		lastErr = err
		if !errors.Is(err, errSmokeNotConnected) {
			return nil, err
		}
		time.Sleep(smokePollInterval)
	}
	return nil, lastErr
}

func evaluateSmokeStatusesOnce(ctx context.Context, options *smokeOptions) ([]smokePluginStatus, error) {
	cli := filepath.Join(options.repository, "packages", "cli", "src", "index.ts")
	evalCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	command := exec.CommandContext(evalCtx, "bun", cli, "eval", "--json", "--port", strconv.Itoa(options.bridgePort), "--timeout", "30000", smokeStatusExpression)
	output, err := command.Output()
	var exit *exec.ExitError
	if errors.As(err, &exit) && exit.ExitCode() == 2 {
		return nil, errSmokeNotConnected
	}
	return parseSmokeEvalOutput(output, err)
}

func parseSmokeEvalOutput(output []byte, runErr error) ([]smokePluginStatus, error) {
	var result struct {
		OK    bool   `json:"ok"`
		Value string `json:"value"`
		Error string `json:"error"`
		Text  string `json:"text"`
	}
	if err := json.Unmarshal(lastJSONLine(output), &result); err != nil {
		if runErr != nil {
			return nil, fmt.Errorf("debugger eval failed: %v: %s", runErr, strings.TrimSpace(string(output)))
		}
		return nil, fmt.Errorf("unreadable debugger eval output %q: %w", strings.TrimSpace(string(output)), err)
	}
	if !result.OK {
		message := result.Error
		if message == "" {
			message = result.Text
		}
		return nil, fmt.Errorf("the plugin status check threw on the device: %s", message)
	}
	var statuses []smokePluginStatus
	if err := json.Unmarshal([]byte(result.Value), &statuses); err != nil {
		return nil, fmt.Errorf("unreadable plugin statuses %q: %w", result.Value, err)
	}
	return statuses, nil
}

func lastJSONLine(output []byte) []byte {
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for index := len(lines) - 1; index >= 0; index-- {
		if line := strings.TrimSpace(lines[index]); strings.HasPrefix(line, "{") {
			return []byte(line)
		}
	}
	return output
}

func smokeProblems(result *smokeResult) []string {
	var problems []string
	problems = append(problems, result.problems...)
	for _, crash := range result.crashes {
		problems = append(problems, "Discord crashed: "+crash)
	}
	for _, plugin := range result.plugins {
		if !result.loaded[plugin.id] {
			problems = append(problems, fmt.Sprintf("the loader never logged Loaded %s", plugin.id))
		}
	}
	if result.count < len(result.plugins) {
		problems = append(problems, fmt.Sprintf("the loader reported %d plugins, expected %d", result.count, len(result.plugins)))
	}
	ids := make([]string, 0, len(result.failures))
	for id := range result.failures {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		problems = append(problems, fmt.Sprintf("%s failed to start: %s", id, result.failures[id][0]))
	}
	if result.evalError != "" {
		problems = append(problems, "debugger check: "+result.evalError)
		return problems
	}
	byID := map[string]smokePluginStatus{}
	for _, status := range result.statuses {
		byID[status.ID] = status
	}
	for _, plugin := range result.plugins {
		status, ok := byID[plugin.id]
		switch {
		case !ok:
			problems = append(problems, fmt.Sprintf("the client does not know %s", plugin.id))
		case status.Failed || !status.Started:
			problems = append(problems, fmt.Sprintf("%s is not started: %s", plugin.id, describeSmokeStatus(status)))
		}
	}
	return problems
}

func describeSmokeStatus(status smokePluginStatus) string {
	if status.Error != "" {
		return status.Error
	}
	if status.Failed {
		return "failed"
	}
	if status.Started {
		return "started"
	}
	return "stopped"
}

func writeSmokeReport(result *smokeResult, options *smokeOptions) {
	report := renderSmokeReport(result)
	_ = os.WriteFile(filepath.Join(options.artifacts, "report.md"), []byte(report), 0o644)
	if options.summary == "" {
		return
	}
	file, err := os.OpenFile(options.summary, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.WriteString(report)
}

func renderSmokeReport(result *smokeResult) string {
	var report strings.Builder
	title := map[string]string{"android": "Android", "ios": "iOS"}[result.platform]
	fmt.Fprintf(&report, "## %s smoke test\n\n", title)
	if len(result.problems) == 0 {
		fmt.Fprintf(&report, "Discord loaded and started all %d first-party plugins without signing in.\n\n", len(result.plugins))
	} else {
		report.WriteString("Failed:\n\n")
		for _, problem := range result.problems {
			fmt.Fprintf(&report, "- %s\n", problem)
		}
		report.WriteString("\n")
	}
	byID := map[string]smokePluginStatus{}
	for _, status := range result.statuses {
		byID[status.ID] = status
	}
	report.WriteString("| Plugin | Loaded by the loader | Debugger status |\n| --- | --- | --- |\n")
	for _, plugin := range result.plugins {
		loaded := "no"
		if result.loaded[plugin.id] {
			loaded = "yes"
		}
		status := "not checked"
		if value, ok := byID[plugin.id]; ok {
			status = describeSmokeStatus(value)
		} else if len(result.statuses) > 0 {
			status = "unknown to the client"
		}
		fmt.Fprintf(&report, "| `%s` | %s | %s |\n", plugin.id, loaded, status)
	}
	report.WriteString("\n")
	return report.String()
}

type smokeLogWatcher struct {
	target   smokeTarget
	mu       sync.Mutex
	loaded   map[string]bool
	count    int
	failures map[string][]string
	crashes  []string
}

func newSmokeLogWatcher(target smokeTarget) *smokeLogWatcher {
	return &smokeLogWatcher{target: target, loaded: map[string]bool{}, failures: map[string][]string{}}
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
		watcher.crashes = append(watcher.crashes, strings.TrimSpace(line))
	}
	if match := smokeAddonFailure.FindStringSubmatch(line); match != nil {
		watcher.failures[match[1]] = append(watcher.failures[match[1]], strings.TrimSpace(line))
	}
	if !watcher.target.isLoaderLine(line) {
		return
	}
	if match := smokeLoadedCount.FindStringSubmatch(line); match != nil {
		watcher.count, _ = strconv.Atoi(match[1])
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
	for id, lines := range watcher.failures {
		result.failures[id] = append([]string(nil), lines...)
	}
	result.crashes = append([]string(nil), watcher.crashes...)
}

func serveSmokeBundle(directory string, port int, requestLog string) (*http.Server, error) {
	if _, err := os.Stat(filepath.Join(directory, "manifest.json")); err != nil {
		return nil, fmt.Errorf("%s is not a built client: %w", directory, err)
	}
	logFile, err := os.Create(requestLog)
	if err != nil {
		return nil, err
	}
	var mu sync.Mutex
	files := http.FileServer(http.Dir(directory))
	server := &http.Server{
		ReadHeaderTimeout: 10 * time.Second,
		Handler: http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
			mu.Lock()
			fmt.Fprintf(logFile, "%s %s %s\n", time.Now().UTC().Format(time.RFC3339), request.Method, request.URL.Path)
			mu.Unlock()
			files.ServeHTTP(writer, request)
		}),
	}
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		logFile.Close()
		return nil, err
	}
	server.RegisterOnShutdown(func() { logFile.Close() })
	go func() { _ = server.Serve(listener) }()
	return server, nil
}

func startSmokeBridge(repository string, port int, logPath string) (*exec.Cmd, error) {
	logFile, err := os.Create(logPath)
	if err != nil {
		return nil, err
	}
	command := exec.Command("bun", filepath.Join(repository, "packages", "debugger", "src", "index.ts"), "--port", strconv.Itoa(port))
	command.Stdout = logFile
	command.Stderr = logFile
	if err := command.Start(); err != nil {
		logFile.Close()
		return nil, fmt.Errorf("start the debugger bridge: %w", err)
	}
	address := fmt.Sprintf("127.0.0.1:%d", port)
	for attempt := 0; attempt < 60; attempt++ {
		connection, err := net.DialTimeout("tcp", address, time.Second)
		if err == nil {
			connection.Close()
			return command, nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	stopSmokeProcess(command)
	return nil, fmt.Errorf("the debugger bridge never listened on %s", address)
}

func stopSmokeProcess(command *exec.Cmd) {
	if command == nil || command.Process == nil {
		return
	}
	_ = command.Process.Kill()
	_ = command.Wait()
}

func runSmokeCommand(ctx context.Context, timeout time.Duration, name string, args ...string) (string, error) {
	commandCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	output, err := exec.CommandContext(commandCtx, name, args...).CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func saveSmokeOutput(ctx context.Context, path string, timeout time.Duration, name string, args ...string) {
	commandCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	output, err := exec.CommandContext(commandCtx, name, args...).Output()
	if err != nil && len(output) == 0 {
		output = []byte(err.Error() + "\n")
	}
	_ = os.WriteFile(path, output, 0o644)
}
