package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	devicePartBytes      = 1536 * 1024
	deviceStagingDir     = "/var/tmp/ubd-smoke"
	deviceBackupArchive  = "/var/tmp/ubd-smoke-backup.tgz"
	deviceTar            = "/var/jb/usr/bin/tar"
	deviceGzip           = "/var/jb/usr/bin/gzip"
	deviceLogFile        = "Logs/astral.log"
	deviceLogPoll        = 2 * time.Second
	deviceRootMarker     = "UBD_ROOT="
	deviceContainersRoot = "/var/mobile/Containers/Data/Application"
)

type deviceSmokeTarget struct {
	udid     string
	pilot    string
	host     string
	root     string
	backedUp bool
	logStart int64
}

func runIOSDeviceSmoke(args []string) error {
	set := flag.NewFlagSet("smoke ios-device", flag.ContinueOnError)
	options := registerSmokeFlags(set)
	udid := set.String("udid", "", "UDID of the jailbroken iPhone, as jb-p1lot lists it")
	host := set.String("host", "", "the address the iPhone reaches this machine at; found from the default route when empty")
	pilot := set.String("pilot", "jb-p1lot", "the jb-p1lot binary")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *udid == "" {
		return errors.New("usage: smoke ios-device --udid <udid> [--host <address>] [--client <dir>] [--plugins <dir>] [--artifacts <dir>]")
	}
	address := *host
	if address == "" {
		detected, err := lanAddress()
		if err != nil {
			return fmt.Errorf("find this machine's address for the iPhone, or pass --host: %w", err)
		}
		address = detected
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	target := &deviceSmokeTarget{udid: *udid, pilot: *pilot, host: address}
	defer target.restore()
	return runSmokeTest(ctx, "ios", options, target)
}

func lanAddress() (string, error) {
	connection, err := net.Dial("udp", "192.0.2.1:9")
	if err != nil {
		return "", err
	}
	defer connection.Close()
	address, ok := connection.LocalAddr().(*net.UDPAddr)
	if !ok || address.IP.IsLoopback() {
		return "", errors.New("no routable local address")
	}
	return address.IP.String(), nil
}

func (target *deviceSmokeTarget) name() string {
	return "the iPhone " + target.udid
}

func (target *deviceSmokeTarget) hostAddress() string {
	return target.host
}

func (target *deviceSmokeTarget) run(ctx context.Context, timeout time.Duration, args ...string) (string, error) {
	command := append([]string{args[0], "--device", target.udid}, args[1:]...)
	return runSmokeCommand(ctx, timeout, target.pilot, command...)
}

func (target *deviceSmokeTarget) shell(ctx context.Context, timeout time.Duration, script string) (string, error) {
	output, err := target.run(ctx, timeout, "shell_exec", "--command", script)
	if err != nil {
		return "", err
	}
	return parsePilotShell(output)
}

func parsePilotShell(output string) (string, error) {
	var result struct {
		ExitCode int    `json:"exitCode"`
		Output   string `json:"output"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		return "", fmt.Errorf("jb-p1lot answered with something other than JSON: %s", strings.TrimSpace(output))
	}
	if result.ExitCode != 0 {
		return result.Output, fmt.Errorf("device command exited with %d: %s", result.ExitCode, strings.TrimSpace(result.Output))
	}
	return result.Output, nil
}

func deviceRootScript() string {
	return strings.Join([]string{
		"for plist in $(grep -l '" + smokeIOSBundleID + "' " + deviceContainersRoot + "/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null); do",
		`if [ -d "${plist%/*}/Documents/astral" ]; then echo "` + deviceRootMarker + `${plist%/*}/Documents/astral"; exit 0; fi`,
		"done",
		"exit 1",
	}, "\n")
}

func parseDeviceRoot(output string) string {
	for _, line := range strings.Split(output, "\n") {
		if root, found := strings.CutPrefix(strings.TrimSpace(line), deviceRootMarker); found {
			return root
		}
	}
	return ""
}

func (target *deviceSmokeTarget) prepare(ctx context.Context, plugins []smokePlugin, settings []byte) error {
	output, err := target.shell(ctx, time.Minute, deviceRootScript())
	if err != nil {
		return fmt.Errorf("find Discord's astral folder; launch Discord with astral once: %w", err)
	}
	target.root = parseDeviceRoot(output)
	if target.root == "" {
		return errors.New("no Discord data container has an astral folder")
	}
	if _, err := target.shell(ctx, 3*time.Minute, "killall -9 Discord 2>/dev/null; cd "+shellQuote(target.root)+" && "+deviceTar+" -cf - . | "+deviceGzip+" > "+deviceBackupArchive); err != nil {
		return fmt.Errorf("back up the astral folder: %w", err)
	}
	target.backedUp = true
	current, err := target.shell(ctx, time.Minute, "cat "+shellQuote(target.root+"/settings.json")+" 2>/dev/null || true")
	if err != nil {
		return err
	}
	merged, err := mergeDeviceSettings([]byte(current), settings)
	if err != nil {
		return err
	}
	archive, err := smokeArchive(plugins, merged)
	if err != nil {
		return err
	}
	if err := target.pushArchive(ctx, archive); err != nil {
		return err
	}
	install := strings.Join([]string{
		"cd " + shellQuote(target.root),
		"rm -rf Plugins",
		deviceGzip + " -dc " + deviceStagingDir + "/smoke.tgz | " + deviceTar + " -xf - --no-same-owner",
		"chown -R mobile:mobile .",
		"rm -rf " + deviceStagingDir,
	}, " && ")
	if _, err := target.shell(ctx, 3*time.Minute, install); err != nil {
		return fmt.Errorf("install the smoke plugins: %w", err)
	}
	size, err := target.shell(ctx, time.Minute, "wc -c < "+shellQuote(target.root+"/"+deviceLogFile)+" 2>/dev/null || echo 0")
	if err != nil {
		return err
	}
	target.logStart, _ = strconv.ParseInt(strings.TrimSpace(size), 10, 64)
	return nil
}

func mergeDeviceSettings(current, smoke []byte) ([]byte, error) {
	merged := map[string]any{}
	if len(bytes.TrimSpace(current)) > 0 {
		if err := json.Unmarshal(current, &merged); err != nil {
			return nil, fmt.Errorf("read the iPhone's settings.json: %w", err)
		}
	}
	var overlay map[string]any
	if err := json.Unmarshal(smoke, &overlay); err != nil {
		return nil, err
	}
	mergeSettingsInto(merged, overlay)
	return json.MarshalIndent(merged, "", "\t")
}

func mergeSettingsInto(base, overlay map[string]any) {
	for key, value := range overlay {
		nested, isObject := value.(map[string]any)
		existing, hasObject := base[key].(map[string]any)
		if isObject && hasObject && key != "states" {
			mergeSettingsInto(existing, nested)
			continue
		}
		base[key] = value
	}
}

func smokeArchive(plugins []smokePlugin, settings []byte) ([]byte, error) {
	var buffer bytes.Buffer
	compressed := gzip.NewWriter(&buffer)
	writer := tar.NewWriter(compressed)
	add := func(name string, data []byte) error {
		if err := writer.WriteHeader(&tar.Header{Name: name, Mode: 0o644, Size: int64(len(data)), Typeflag: tar.TypeReg}); err != nil {
			return err
		}
		_, err := writer.Write(data)
		return err
	}
	if err := add("settings.json", settings); err != nil {
		return nil, err
	}
	for _, plugin := range plugins {
		for _, file := range plugin.files {
			data, err := os.ReadFile(filepath.Join(plugin.directory, file))
			if err != nil {
				return nil, err
			}
			if err := add("Plugins/"+plugin.id+"/"+file, data); err != nil {
				return nil, err
			}
		}
	}
	if err := errors.Join(writer.Close(), compressed.Close()); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func splitParts(data []byte, size int) [][]byte {
	var parts [][]byte
	for len(data) > size {
		parts = append(parts, data[:size])
		data = data[size:]
	}
	return append(parts, data)
}

func (target *deviceSmokeTarget) pushArchive(ctx context.Context, archive []byte) error {
	local, err := os.MkdirTemp("", "ubd-smoke-parts-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(local)
	if _, err := target.shell(ctx, time.Minute, "rm -rf "+deviceStagingDir+" && mkdir -p "+deviceStagingDir); err != nil {
		return err
	}
	parts := splitParts(archive, devicePartBytes)
	names := make([]string, 0, len(parts))
	for index, part := range parts {
		name := fmt.Sprintf("part-%03d", index)
		path := filepath.Join(local, name)
		if err := os.WriteFile(path, part, 0o644); err != nil {
			return err
		}
		if _, err := target.run(ctx, 2*time.Minute, "file_transfer", "--direction", "host_to_device", "--source", path, "--destination", deviceStagingDir+"/"+name); err != nil {
			return fmt.Errorf("transfer the smoke archive: %w", err)
		}
		names = append(names, deviceStagingDir+"/"+name)
	}
	_, err = target.shell(ctx, time.Minute, "cat "+strings.Join(names, " ")+" > "+deviceStagingDir+"/smoke.tgz && rm -f "+strings.Join(names, " "))
	return err
}

func (target *deviceSmokeTarget) streamLogs(ctx context.Context) (io.ReadCloser, func() error, error) {
	reader, writer := io.Pipe()
	streamCtx, cancel := context.WithCancel(ctx)
	var done sync.WaitGroup
	done.Add(1)
	go func() {
		defer done.Done()
		defer writer.Close()
		offset := target.logStart
		for streamCtx.Err() == nil {
			chunk, err := target.shell(streamCtx, 30*time.Second, fmt.Sprintf("tail -c +%d %s 2>/dev/null", offset+1, shellQuote(target.root+"/"+deviceLogFile)))
			if err == nil && chunk != "" {
				complete := strings.LastIndex(chunk, "\n") + 1
				if complete > 0 {
					if _, err := io.WriteString(writer, chunk[:complete]); err != nil {
						return
					}
					offset += int64(complete)
				}
			}
			select {
			case <-streamCtx.Done():
			case <-time.After(deviceLogPoll):
			}
		}
	}()
	stop := func() error {
		cancel()
		reader.Close()
		done.Wait()
		return nil
	}
	return reader, stop, nil
}

func (target *deviceSmokeTarget) launch(ctx context.Context) error {
	_, _ = target.run(ctx, time.Minute, "ui_action", "--action", "button", "--button", "unlock")
	_, err := target.shell(ctx, 2*time.Minute, "killall -9 Discord 2>/dev/null; sleep 1; /var/jb/usr/bin/uiopen --bundleid "+smokeIOSBundleID)
	return err
}

func (target *deviceSmokeTarget) running(ctx context.Context) bool {
	output, err := target.shell(ctx, 30*time.Second, "ps -A -o comm | grep -c '/Discord$' || true")
	if err != nil {
		return true
	}
	count, _ := strconv.Atoi(strings.TrimSpace(output))
	return count > 0
}

func (target *deviceSmokeTarget) isLoaderLine(string) bool {
	return true
}

func (target *deviceSmokeTarget) consoleEntry(line string) (smokeConsoleEntry, bool) {
	return deviceConsoleEntry(line)
}

func (target *deviceSmokeTarget) isCrashLine(string) bool {
	return false
}

func (target *deviceSmokeTarget) collect(ctx context.Context, artifacts string) {
	if output, err := target.run(ctx, time.Minute, "screen_capture"); err == nil {
		if png := screenCapturePNG(output); png != nil {
			_ = os.WriteFile(filepath.Join(artifacts, "screenshot.png"), png, 0o644)
		}
	}
	if target.root == "" {
		return
	}
	if settings, err := target.shell(ctx, time.Minute, "cat "+shellQuote(target.root+"/settings.json")); err == nil {
		_ = os.WriteFile(filepath.Join(artifacts, "settings-after.json"), []byte(settings), 0o644)
	}
}

func screenCapturePNG(output string) []byte {
	var capture map[string]any
	if json.Unmarshal([]byte(output), &capture) != nil {
		return nil
	}
	for _, key := range []string{"png", "data", "image"} {
		if encoded, ok := capture[key].(string); ok {
			if data, err := base64.StdEncoding.DecodeString(encoded); err == nil {
				return data
			}
		}
	}
	return nil
}

func (target *deviceSmokeTarget) restore() {
	if !target.backedUp {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	script := strings.Join([]string{
		"killall -9 Discord 2>/dev/null",
		"cd " + shellQuote(target.root),
		"find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +",
		deviceGzip + " -dc " + deviceBackupArchive + " | " + deviceTar + " -xf -",
		"chown -R mobile:mobile .",
		"rm -f " + deviceBackupArchive,
	}, "; ")
	if _, err := target.shell(ctx, 4*time.Minute, script); err != nil {
		fmt.Fprintf(os.Stderr, "smoke: restoring the iPhone's astral folder failed, its backup is at %s: %v\n", deviceBackupArchive, err)
		return
	}
	_, _ = target.shell(ctx, time.Minute, "/var/jb/usr/bin/uiopen --bundleid "+smokeIOSBundleID)
	fmt.Println("Restored the iPhone's astral folder")
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'"'"'`) + "'"
}
