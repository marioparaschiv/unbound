package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

type avdProfile struct {
	Name                 string `json:"name"`
	Device               string `json:"device"`
	SystemImage          string `json:"systemImage"`
	SystemImageDirectory string `json:"systemImageDirectory"`
	ABI                  string `json:"abi"`
	PlayStore            bool   `json:"playStore"`
	RAMMiB               int    `json:"ramMiB"`
	CPUCores             int    `json:"cpuCores"`
	GPU                  string `json:"gpuMode"`
	Width                int    `json:"width"`
	Height               int    `json:"height"`
	DensityDPI           int    `json:"densityDpi"`
	DataPartition        string `json:"dataPartition"`
	HeapMiB              int    `json:"heapMiB"`
}

type androidDevice struct {
	Serial string
	AVD    string
	State  string
}

func runDev(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: dev <status|android-avd>")
	}
	switch args[0] {
	case "status":
		set := flag.NewFlagSet("dev status", flag.ContinueOnError)
		root := set.String("root", ".", "repository root")
		if err := set.Parse(args[1:]); err != nil {
			return err
		}
		rootPath, err := filepath.Abs(*root)
		if err != nil {
			return err
		}
		return reportDevStatus(rootPath)
	case "android-avd":
		return runAndroidAVD(args[1:])
	default:
		return fmt.Errorf("unknown dev command %q", args[0])
	}
}

func runAndroidAVD(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: dev android-avd <status|setup|start> [--name <name>] [--root <path>]")
	}
	action := args[0]
	if action != "status" && action != "setup" && action != "start" {
		return fmt.Errorf("unknown android-avd action %q", action)
	}
	set := flag.NewFlagSet("dev android-avd", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	name := set.String("name", "", "Android virtual device name")
	if err := set.Parse(args[1:]); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	profile, err := readAVDProfile(rootPath)
	if err != nil {
		return err
	}
	if *name != "" {
		profile.Name = *name
	}
	switch action {
	case "status":
		return reportAVDStatus(profile)
	case "setup":
		return setupAVD(profile)
	case "start":
		return startAVD(profile)
	default:
		return nil
	}
}

func readAVDProfile(root string) (avdProfile, error) {
	data, err := os.ReadFile(filepath.Join(root, "android", "dev-environment", "avd.json"))
	if err != nil {
		return avdProfile{}, fmt.Errorf("read Android AVD profile: %w", err)
	}
	var profile avdProfile
	if err := json.Unmarshal(data, &profile); err != nil {
		return avdProfile{}, fmt.Errorf("decode Android AVD profile: %w", err)
	}
	if profile.Name == "" || profile.Device == "" || profile.SystemImage == "" ||
		profile.SystemImageDirectory == "" || profile.ABI == "" || profile.RAMMiB < 1 ||
		profile.CPUCores < 1 || profile.GPU == "" || profile.Width < 1 || profile.Height < 1 ||
		profile.DensityDPI < 1 || profile.DataPartition == "" || profile.HeapMiB < 1 {
		return avdProfile{}, errors.New("Android AVD profile is incomplete")
	}
	return profile, nil
}

func reportDevStatus(root string) error {
	profile, err := readAVDProfile(root)
	if err != nil {
		return err
	}
	fmt.Printf("Host: %s/%s\n", runtime.GOOS, runtime.GOARCH)
	for _, name := range []string{"go", "git", "emulator", "adb", "avdmanager", "sdkmanager", "xcodebuild", "xcrun", "vphone-cli", "jb-p1lot"} {
		if _, err := exec.LookPath(name); err != nil {
			fmt.Printf("Tool %-12s unavailable\n", name)
			continue
		}
		fmt.Printf("Tool %-12s ready\n", name)
	}
	if err := reportAVDStatus(profile); err != nil {
		fmt.Printf("Android AVD status: %v\n", err)
	}
	reportSimulatorStatus()
	reportVPhoneStatus()
	reportJBPilotStatus()
	return nil
}

func reportAVDStatus(profile avdProfile) error {
	path, err := avdConfigPath(profile.Name)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			fmt.Printf("Android AVD %s: not created; run `go run ./tools dev android-avd setup`\n", profile.Name)
			return nil
		}
		return err
	}
	config := parseAVDConfig(string(data))
	fmt.Printf("Android AVD %s: %s; GPU=%s; CPU=%s; RAM=%s MiB\n", profile.Name, configStatus(config, profile), config["hw.gpu.mode"], config["hw.cpu.ncore"], config["hw.ramSize"])
	devices, err := listAndroidDevices()
	if err != nil {
		return err
	}
	for _, device := range devices {
		if device.AVD != profile.Name || device.State != "device" {
			continue
		}
		api, release, identity, err := inspectAndroidDevice(device.Serial)
		if err != nil {
			return err
		}
		rooted := strings.Contains(identity, "uid=0(root)")
		fmt.Printf("Android target %s: Android %s (API %s), root=%t\n", device.Serial, release, api, rooted)
		return nil
	}
	fmt.Println("Android target: not running")
	return nil
}

func configStatus(config map[string]string, profile avdProfile) string {
	want := avdConfigValues(profile)
	for key, value := range want {
		if config[key] != value {
			return "configuration differs; run `go run ./tools dev android-avd setup` while stopped"
		}
	}
	return "configured"
}

func setupAVD(profile avdProfile) error {
	if !emulatorAccelerationAvailable() {
		return errors.New("Android emulator hardware acceleration is unavailable on this host")
	}
	path, err := avdConfigPath(profile.Name)
	if err != nil {
		return err
	}
	devices, err := listAndroidDevices()
	if err != nil {
		return err
	}
	for _, device := range devices {
		if device.AVD == profile.Name && device.State == "device" {
			return errors.New("stop the Android AVD before applying its configuration")
		}
	}
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		if err := createAVD(profile); err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read AVD config: %w", err)
	}
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	updated := updateAVDConfig(string(data), avdConfigValues(profile))
	if err := os.WriteFile(path, []byte(updated), info.Mode().Perm()); err != nil {
		return fmt.Errorf("write AVD config: %w", err)
	}
	fmt.Printf("Android AVD %s is configured. Start it with `go run ./tools dev android-avd start`.\n", profile.Name)
	return nil
}

func createAVD(profile avdProfile) error {
	image, err := androidSystemImagePath(profile)
	if err != nil {
		return err
	}
	if _, err := os.Stat(image); errors.Is(err, os.ErrNotExist) {
		if err := devRunCommand("sdkmanager", "--install", profile.SystemImage); err != nil {
			return fmt.Errorf("install Android system image; accept Android SDK licenses with `sdkmanager --licenses` if prompted: %w", err)
		}
	} else if err != nil {
		return err
	}
	command := exec.Command("avdmanager", "create", "avd", "--name", profile.Name, "--package", profile.SystemImage, "--device", profile.Device)
	command.Stdin = strings.NewReader("no\n")
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("create Android AVD: %w", err)
	}
	return nil
}

func startAVD(profile avdProfile) error {
	path, err := avdConfigPath(profile.Name)
	if err != nil {
		return err
	}
	if _, err := os.Stat(path); err != nil {
		return fmt.Errorf("Android AVD %s is not configured; run `go run ./tools dev android-avd setup`", profile.Name)
	}
	configData, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if status := configStatus(parseAVDConfig(string(configData)), profile); status != "configured" {
		return fmt.Errorf("Android AVD %s %s", profile.Name, status)
	}
	if !emulatorAccelerationAvailable() {
		return errors.New("Android emulator hardware acceleration is unavailable on this host")
	}
	devices, err := listAndroidDevices()
	if err != nil {
		return err
	}
	serial := ""
	for _, device := range devices {
		if device.AVD == profile.Name && device.State == "device" {
			serial = device.Serial
			break
		}
	}
	if serial == "" {
		logFile, err := os.OpenFile(filepath.Join(os.TempDir(), "unbound-"+profile.Name+".log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		command := exec.Command("emulator", "-avd", profile.Name, "-accel", "on", "-gpu", profile.GPU, "-no-boot-anim")
		command.Stdout = logFile
		command.Stderr = logFile
		if err := command.Start(); err != nil {
			logFile.Close()
			return err
		}
		if err := command.Process.Release(); err != nil {
			return err
		}
		logFile.Close()
		fmt.Printf("Started Android AVD %s; boot log: %s\n", profile.Name, filepath.Join(os.TempDir(), "unbound-"+profile.Name+".log"))
		serial, err = waitForAVD(profile.Name, 3*time.Minute)
		if err != nil {
			return err
		}
	}
	if err := rootAndroidDevice(serial); err != nil {
		return err
	}
	api, release, identity, err := inspectAndroidDevice(serial)
	if err != nil {
		return err
	}
	if !strings.Contains(identity, "uid=0(root)") {
		return errors.New("Android AVD did not provide a root shell")
	}
	fmt.Printf("Android target %s ready: Android %s (API %s), rooted\n", serial, release, api)
	return nil
}

func reportSimulatorStatus() {
	if _, err := exec.LookPath("xcrun"); err != nil {
		fmt.Println("iOS Simulator: xcrun unavailable")
		return
	}
	output, err := devCommandOutput("xcrun", "simctl", "list", "devices", "available")
	if err != nil {
		fmt.Printf("iOS Simulator: %v\n", err)
		return
	}
	lines := strings.Split(strings.TrimSpace(output), "\n")
	booted := []string{}
	available := 0
	for _, line := range lines {
		if strings.Contains(line, "(Booted)") || strings.Contains(line, "(Shutdown)") {
			available++
		}
		if strings.Contains(line, "(Booted)") {
			booted = append(booted, strings.TrimSpace(line))
		}
	}
	fmt.Printf("iOS Simulator: %d available, %d booted; list with `xcrun simctl list devices available`\n", available, len(booted))
	for _, line := range booted {
		fmt.Println(" ", line)
	}
}

func reportVPhoneStatus() {
	if _, err := exec.LookPath("vphone-cli"); err != nil {
		fmt.Println("vphone: vphone-cli unavailable")
		return
	}
	output, err := devCommandOutput("vphone-cli", "vm", "list")
	if err != nil {
		fmt.Printf("vphone: %v\n", err)
		return
	}
	fmt.Println("vphone:", strings.TrimSpace(output))
}

func reportJBPilotStatus() {
	if _, err := exec.LookPath("jb-p1lot"); err != nil {
		fmt.Println("jb-p1lot: CLI unavailable")
		return
	}
	output, err := devCommandOutput("jb-p1lot", "device_list")
	if err != nil {
		fmt.Printf("jb-p1lot: %v\n", err)
		return
	}
	var result struct {
		Devices []struct {
			ID string `json:"id"`
		} `json:"devices"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		fmt.Println("jb-p1lot: CLI ready; device list could not be parsed")
		return
	}
	fmt.Printf("jb-p1lot: %d paired device(s)\n", len(result.Devices))
	for _, device := range result.Devices {
		status, err := devCommandOutput("jb-p1lot", "device_status", "--device", device.ID)
		if err != nil {
			fmt.Printf("  %s: unavailable\n", device.ID)
			continue
		}
		var state struct {
			Device struct {
				OSVersion  string `json:"osVersion"`
				Jailbroken bool   `json:"jailbroken"`
				Bridge     bool   `json:"bridge"`
			} `json:"device"`
		}
		if json.Unmarshal([]byte(status), &state) != nil {
			fmt.Printf("  %s: connected\n", device.ID)
			continue
		}
		fmt.Printf("  %s: iOS %s, jailbroken=%t, bridge=%t\n", device.ID, state.Device.OSVersion, state.Device.Jailbroken, state.Device.Bridge)
	}
}

func avdConfigPath(name string) (string, error) {
	avdHome := os.Getenv("ANDROID_AVD_HOME")
	if avdHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		avdHome = filepath.Join(home, ".android", "avd")
	}
	return filepath.Join(avdHome, name+".avd", "config.ini"), nil
}

func androidSDKRoot() (string, error) {
	for _, key := range []string{"ANDROID_HOME", "ANDROID_SDK_ROOT"} {
		if value := os.Getenv(key); value != "" {
			return value, nil
		}
	}
	emulator, err := exec.LookPath("emulator")
	if err != nil {
		return "", errors.New("Android SDK is unavailable; set ANDROID_HOME or add emulator to PATH")
	}
	return filepath.Dir(filepath.Dir(emulator)), nil
}

func androidSystemImagePath(profile avdProfile) (string, error) {
	root, err := androidSDKRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, filepath.FromSlash(profile.SystemImageDirectory)), nil
}

func avdConfigValues(profile avdProfile) map[string]string {
	return map[string]string{
		"AvdId":                   profile.Name,
		"PlayStore.enabled":       strconv.FormatBool(profile.PlayStore),
		"abi.type":                profile.ABI,
		"disk.dataPartition.size": profile.DataPartition,
		"hw.cpu.arch":             "arm64",
		"hw.cpu.ncore":            strconv.Itoa(profile.CPUCores),
		"hw.device.name":          profile.Device,
		"hw.gpu.enabled":          "yes",
		"hw.gpu.mode":             profile.GPU,
		"hw.lcd.density":          strconv.Itoa(profile.DensityDPI),
		"hw.lcd.height":           strconv.Itoa(profile.Height),
		"hw.lcd.width":            strconv.Itoa(profile.Width),
		"hw.ramSize":              strconv.Itoa(profile.RAMMiB),
		"image.sysdir.1":          profile.SystemImageDirectory,
		"showDeviceFrame":         "no",
		"tag.display":             "Google APIs",
		"tag.id":                  "google_apis",
		"vm.heapSize":             strconv.Itoa(profile.HeapMiB),
	}
}

func parseAVDConfig(data string) map[string]string {
	values := map[string]string{}
	scanner := bufio.NewScanner(strings.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if found {
			values[strings.TrimSpace(key)] = strings.TrimSpace(value)
		}
	}
	return values
}

func updateAVDConfig(data string, updates map[string]string) string {
	keys := make([]string, 0, len(updates))
	for key := range updates {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	remaining := make(map[string]string, len(updates))
	for key, value := range updates {
		remaining[key] = value
	}
	lines := strings.Split(strings.TrimSuffix(data, "\n"), "\n")
	updated := make([]string, 0, len(lines)+len(updates))
	for _, line := range lines {
		key, _, found := strings.Cut(line, "=")
		if found {
			if value, exists := remaining[strings.TrimSpace(key)]; exists {
				updated = append(updated, key+"="+value)
				delete(remaining, strings.TrimSpace(key))
				continue
			}
		}
		updated = append(updated, line)
	}
	for _, key := range keys {
		if value, exists := remaining[key]; exists {
			updated = append(updated, key+"="+value)
		}
	}
	return strings.Join(updated, "\n") + "\n"
}

func listAndroidDevices() ([]androidDevice, error) {
	output, err := devCommandOutput("adb", "devices", "-l")
	if err != nil {
		return nil, err
	}
	devices := []androidDevice{}
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 || !strings.HasPrefix(fields[0], "emulator-") {
			continue
		}
		name, _ := devCommandOutput("adb", "-s", fields[0], "emu", "avd", "name")
		devices = append(devices, androidDevice{Serial: fields[0], AVD: strings.TrimSpace(strings.Split(name, "\n")[0]), State: fields[1]})
	}
	return devices, nil
}

func inspectAndroidDevice(serial string) (string, string, string, error) {
	api, err := devCommandOutput("adb", "-s", serial, "shell", "getprop", "ro.build.version.sdk")
	if err != nil {
		return "", "", "", err
	}
	release, err := devCommandOutput("adb", "-s", serial, "shell", "getprop", "ro.build.version.release")
	if err != nil {
		return "", "", "", err
	}
	identity, err := devCommandOutput("adb", "-s", serial, "shell", "id")
	return strings.TrimSpace(api), strings.TrimSpace(release), identity, err
}

func rootAndroidDevice(serial string) error {
	identity, err := devCommandOutput("adb", "-s", serial, "shell", "id")
	if err != nil {
		return err
	}
	if strings.Contains(identity, "uid=0(root)") {
		return nil
	}
	if err := devRunCommand("adb", "-s", serial, "root"); err != nil {
		return err
	}
	if err := devRunCommand("adb", "-s", serial, "wait-for-device"); err != nil {
		return err
	}
	identity, err = devCommandOutput("adb", "-s", serial, "shell", "id")
	if err != nil {
		return err
	}
	if !strings.Contains(identity, "uid=0(root)") {
		return errors.New("adb root did not provide a root shell")
	}
	return nil
}

func waitForAVD(name string, timeout time.Duration) (string, error) {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		devices, err := listAndroidDevices()
		if err == nil {
			for _, device := range devices {
				if device.AVD == name && device.State == "device" {
					_ = devRunCommand("adb", "-s", device.Serial, "wait-for-device")
					booted, _ := devCommandOutput("adb", "-s", device.Serial, "shell", "getprop", "sys.boot_completed")
					if strings.TrimSpace(booted) == "1" {
						return device.Serial, nil
					}
				}
			}
		}
		time.Sleep(2 * time.Second)
	}
	return "", fmt.Errorf("Android AVD %s did not finish booting within %s", name, timeout)
}

func emulatorAccelerationAvailable() bool {
	output, err := devCommandOutput("emulator", "-accel-check")
	return err == nil && strings.Contains(strings.ToLower(output), "accel")
}

func devCommandOutput(name string, args ...string) (string, error) {
	command := exec.Command(name, args...)
	output, err := command.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

func devRunCommand(name string, args ...string) error {
	command := exec.Command(name, args...)
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	return command.Run()
}
