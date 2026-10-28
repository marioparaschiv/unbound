package main

import (
	"archive/zip"
	"bufio"
	"crypto/ecdsa"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

const (
	cyanRepository     = "https://github.com/asdfzxcvbn/pyzule-rw"
	cyanCommit         = "740d3716dcd98c20c000f12cdb88f1f0b2a533a4"
	linkRelayAppName   = "UnboundLink.app"
	pillowVersion      = "11.3.0"
	simforgeRepository = "https://github.com/EthanArbuckle/simforge"
	simforgeCommit     = "c1de4439aa00a6057d497f6097fecda530800a29"
)

type buildOptions struct {
	root           string
	configuration  string
	ipa            string
	deb            string
	channel        string
	output         string
	simulator      bool
	nonInteractive bool
	keepWork       bool
}

type commandRunner func(root string, name string, args []string, env []string, stdout, stderr io.Writer) error

func runBuild(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: build <tweak|ipa|simulator|all>")
	}
	switch args[0] {
	case "tweak":
		options, err := parseBuildOptions(args[1:], false)
		if err != nil {
			return err
		}
		if err := validateWorkspace(options.root); err != nil {
			return err
		}
		return buildTweak(options, defaultRunner)
	case "ipa":
		options, err := parseBuildOptions(args[1:], false)
		if err != nil {
			return err
		}
		if err := validateWorkspace(options.root); err != nil {
			return err
		}
		return buildIPA(options, defaultRunner)
	case "simulator":
		options, err := parseBuildOptions(args[1:], false)
		if err != nil {
			return err
		}
		if err := validateWorkspace(options.root); err != nil {
			return err
		}
		return buildSimulator(options, defaultRunner)
	case "all":
		options, err := parseBuildOptions(args[1:], true)
		if err != nil {
			return err
		}
		if err := validateWorkspace(options.root); err != nil {
			return err
		}
		return buildAll(options, defaultRunner)
	default:
		return fmt.Errorf("unknown build command %q", args[0])
	}
}

func parseBuildOptions(args []string, all bool) (buildOptions, error) {
	set := flag.NewFlagSet("build", flag.ContinueOnError)
	options := buildOptions{}
	set.StringVar(&options.root, "root", ".", "repository root")
	set.StringVar(&options.configuration, "configuration", "release", "debug or release")
	set.StringVar(&options.ipa, "ipa", "", "source or output IPA path/URL")
	set.StringVar(&options.deb, "deb", "", "tweak package path")
	set.StringVar(&options.channel, "channel", "appstore", "appstore or testflight")
	set.StringVar(&options.output, "output", "", "output path")
	set.BoolVar(&options.simulator, "simulator", false, "build simulator artifact")
	set.BoolVar(&options.nonInteractive, "non-interactive", false, "disable prompts")
	set.BoolVar(&options.keepWork, "keep-work", false, "preserve temporary workspace")
	if err := set.Parse(args); err != nil {
		return options, err
	}
	if options.configuration != "debug" && options.configuration != "release" {
		return options, errors.New("configuration must be debug or release")
	}
	if options.channel != "appstore" && options.channel != "testflight" {
		return options, errors.New("channel must be appstore or testflight")
	}
	if !all && options.simulator {
		return options, errors.New("--simulator is only valid with build all")
	}
	root, err := filepath.Abs(options.root)
	if err != nil {
		return options, err
	}
	options.root = root
	return options, nil
}

func buildAll(options buildOptions, runner commandRunner) error {
	if err := preflight(options, runner); err != nil {
		return err
	}
	if err := buildTweak(options, runner); err != nil {
		return err
	}
	if options.deb == "" {
		options.deb, _ = firstMatch(filepath.Join(iosRoot(options.root), "packages"), ".deb")
	}
	if options.deb == "" {
		return errors.New("no .deb package was produced")
	}
	if options.output == "" {
		name, err := packageName(options.root)
		if err != nil {
			return err
		}
		options.output = filepath.Join(options.root, name+".ipa")
	}
	if err := buildIPA(options, runner); err != nil {
		return err
	}
	if options.simulator {
		simulator := options.output
		if strings.HasSuffix(simulator, ".ipa") {
			simulator = strings.TrimSuffix(simulator, ".ipa")
		}
		simulator += "-simulator.zip"
		options.ipa = options.output
		options.output = simulator
		if err := buildSimulator(options, runner); err != nil {
			return err
		}
	}
	return nil
}

func preflight(options buildOptions, runner commandRunner) error {
	if err := ensureSubmodules(options.root, runner); err != nil {
		return err
	}
	if options.configuration == "release" {
		if _, _, err := attestationKeys(); err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				return err
			}
			fmt.Println("no attestation private key found; release artifact will carry a runtime warning")
		}
	}
	return nil
}

func buildTweak(options buildOptions, runner commandRunner) error {
	if err := ensureSubmodules(options.root, runner); err != nil {
		return err
	}
	makeName := "make"
	if runtime.GOOS == "darwin" {
		makeName = "gmake"
	}
	args := []string{"package"}
	if options.configuration == "debug" {
		args = append(args, "DEBUG=1")
	}
	env := append(os.Environ(), "TOOLS_COMMAND="+toolsCommand())
	fmt.Printf("building tweak (%s)\n", options.configuration)
	return runner(iosRoot(options.root), makeName, args, env, os.Stdout, os.Stderr)
}

func buildIPA(options buildOptions, runner commandRunner) error {
	if options.ipa == "" {
		resolved, err := resolveIPA(options)
		if err != nil {
			return err
		}
		options.ipa = resolved
	}
	if options.deb == "" {
		options.deb, _ = firstMatch(filepath.Join(iosRoot(options.root), "packages"), ".deb")
	}
	if options.deb == "" {
		return errors.New("tweak package path is required")
	}
	if options.output == "" {
		name, err := packageName(options.root)
		if err != nil {
			return err
		}
		options.output = filepath.Join(options.root, name+".ipa")
	}
	work, err := os.MkdirTemp("", "loader-tools-")
	if err != nil {
		return err
	}
	if !options.keepWork {
		defer os.RemoveAll(work)
	} else {
		fmt.Println("preserving workspace:", work)
	}
	input := options.ipa
	if strings.HasPrefix(input, "http://") || strings.HasPrefix(input, "https://") {
		input = filepath.Join(work, "source.ipa")
		if err := downloadDirect(options.ipa, "", input); err != nil {
			return err
		}
	}
	if _, err := os.Stat(input); err != nil {
		return fmt.Errorf("IPA not found: %s", input)
	}
	patched := filepath.Join(work, "patched.ipa")
	if options.channel == "testflight" {
		patched = input
	} else {
		if err := patchIPA(input, patched); err != nil {
			return fmt.Errorf("patching IPA failed: %w", err)
		}
	}
	if err := rejectInjectedIPA(patched, work, runner); err != nil {
		return err
	}
	sourceEntries, err := zipList(patched, runner, options.root)
	if err != nil {
		return err
	}
	extensionPaths, err := buildExtensions(options, work, runner)
	if err != nil {
		return err
	}
	cyan, err := provisionCyan(options.root, runner)
	if err != nil {
		return err
	}
	injectionOutput := options.output
	if samePath(input, options.output) {
		injectionOutput = filepath.Join(work, "injected.ipa")
	}
	args := []string{"-duwsgq"}
	if options.channel == "testflight" {
		args = append(args, "-b", "com.hammerandchisel.discord.testflight")
	}
	args = append(args, "-i", patched, "-o", injectionOutput, "-f", options.deb)
	args = append(args, extensionPaths...)
	if err := runner(options.root, cyan, args, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return fmt.Errorf("IPA injection failed: %w", err)
	}
	if injectionOutput != options.output {
		if err := os.Rename(injectionOutput, options.output); err != nil {
			return err
		}
	}
	finalEntries, err := zipList(options.output, runner, options.root)
	if err != nil {
		return err
	}
	if err := validateIPAExtensions(sourceEntries, finalEntries); err != nil {
		return err
	}
	if err := rejectLinkRelayApp(finalEntries); err != nil {
		return err
	}
	if err := validateIPAExtensionExecutables(options.output); err != nil {
		return err
	}
	if options.configuration == "release" {
		if _, _, keyErr := attestationKeys(); keyErr == nil {
			if err := verifyIPA(options.output, work, runner); err != nil {
				return err
			}
		} else if !errors.Is(keyErr, os.ErrNotExist) {
			return keyErr
		} else {
			fmt.Println("no attestation private key found; final IPA will warn at runtime")
		}
	}
	fmt.Println("created", options.output)
	return nil
}

func buildSimulator(options buildOptions, runner commandRunner) error {
	if runtime.GOOS != "darwin" {
		return errors.New("simulator builds require macOS")
	}
	if options.ipa == "" {
		return errors.New("--ipa is required for simulator builds")
	}
	if options.output == "" {
		return errors.New("--output is required for simulator builds")
	}
	if !filepath.IsAbs(options.output) {
		options.output = filepath.Join(options.root, options.output)
	}
	work, err := os.MkdirTemp("", "loader-simulator-")
	if err != nil {
		return err
	}
	if !options.keepWork {
		defer os.RemoveAll(work)
	}
	if err := unzip(options.ipa, work, runner, options.root); err != nil {
		return err
	}
	simforge, err := provisionSimforge(options.root, runner)
	if err != nil {
		return err
	}
	app := filepath.Join(work, "Payload", "Discord.app")
	if err := runner(options.root, simforge, []string{"convert", app}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	if err := retargetLegacyFrameworks(app, runner, options.root); err != nil {
		return err
	}
	frameworks, _ := filepath.Glob(filepath.Join(app, "Frameworks", "*"))
	for _, framework := range frameworks {
		_ = runner(options.root, "codesign", []string{"-f", "-s", "-", framework}, os.Environ(), os.Stdout, os.Stderr)
	}
	if err := runner(options.root, "codesign", []string{"-f", "-s", "-", app}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	dylib, err := findFile(app, "Unbound.dylib")
	if err != nil {
		return err
	}
	if options.configuration != "debug" {
		private, public, keyErr := attestationKeys()
		if keyErr == nil {
			commit, _ := gitOutput(options.root, runner, "rev-parse", "HEAD")
			version, versionErr := packageVersion(options.root)
			if versionErr != nil {
				return versionErr
			}
			if err := signFile(dylib, private, strings.TrimSpace(commit), version); err != nil {
				return err
			}
			if err := runner(options.root, "codesign", []string{"-f", "-s", "-", dylib}, os.Environ(), os.Stdout, os.Stderr); err != nil {
				return err
			}
			if _, err := verifyFile(dylib, public); err != nil {
				return err
			}
		} else if !errors.Is(keyErr, os.ErrNotExist) {
			return keyErr
		} else {
			fmt.Println("no attestation private key found; simulator artifact will carry a runtime warning")
		}
	}
	if err := zipDirectory(filepath.Join(work, "Payload"), options.output, runner, options.root); err != nil {
		return err
	}
	fmt.Println("created", options.output)
	return nil
}

func resolveIPA(options buildOptions) (string, error) {
	matches, err := filepath.Glob(filepath.Join(options.root, "*.ipa"))
	if err != nil {
		return "", err
	}
	if len(matches) == 1 {
		return matches[0], nil
	}
	if len(matches) > 1 {
		return "", errors.New("multiple root-level IPA files found; pass --ipa explicitly")
	}
	if options.nonInteractive || !isTerminal(os.Stdin) {
		return "", errors.New("--ipa is required in non-interactive mode")
	}
	fmt.Print("Discord IPA path or URL: ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		return "", err
	}
	line = strings.TrimSpace(line)
	if line == "" {
		return "", errors.New("no IPA input provided")
	}
	return line, nil
}

func iosRoot(root string) string {
	return filepath.Join(root, "ios")
}

func ensureSubmodules(root string, runner commandRunner) error {
	return runner(root, "git", []string{"submodule", "update", "--init", "--recursive"}, os.Environ(), os.Stdout, os.Stderr)
}

func packageName(root string) (string, error) {
	data, err := os.ReadFile(filepath.Join(iosRoot(root), "control"))
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "Name:") {
			value := strings.TrimSpace(strings.TrimPrefix(line, "Name:"))
			if value != "" {
				return value, nil
			}
		}
	}
	return "", errors.New("package name not found in control")
}

func packageVersion(root string) (string, error) {
	data, err := os.ReadFile(filepath.Join(iosRoot(root), "control"))
	if err != nil {
		return "", err
	}
	return packageVersionFromControl(string(data))
}

func packageVersionFromControl(contents string) (string, error) {
	for _, line := range strings.Split(contents, "\n") {
		if strings.HasPrefix(line, "Version:") {
			value := strings.TrimSpace(strings.TrimPrefix(line, "Version:"))
			if value != "" {
				return value, nil
			}
		}
	}
	return "", errors.New("package version not found in control")
}

func attestationKeys() (*ecdsa.PrivateKey, *ecdsa.PublicKey, error) {
	privateBytes, err := privateKeyBytes()
	if err != nil {
		return nil, nil, err
	}
	private, err := parsePrivateKey(privateBytes)
	if err != nil {
		return nil, nil, err
	}
	public, err := pinnedPublicKey()
	if err != nil {
		return nil, nil, err
	}
	if !publicKeysEqual(&private.PublicKey, public) {
		return nil, nil, errors.New("attestation private key does not match the pinned public key")
	}
	return private, public, nil
}

func provisionCyan(root string, runner commandRunner) (string, error) {
	cache := filepath.Join(root, ".tools-cache", "cyan-"+cyanCommit)
	python := filepath.Join(cache, "venv", "bin", "python3")
	binary := filepath.Join(cache, "venv", "bin", "cyan")
	if executableExists(binary) {
		return binary, nil
	}
	if err := os.MkdirAll(cache, 0o755); err != nil {
		return "", err
	}
	if err := runner(root, "python3", []string{"-m", "venv", filepath.Join(cache, "venv")}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return "", err
	}
	archive := cyanRepository + "/archive/" + cyanCommit + ".zip"
	if err := runner(root, python, []string{"-m", "pip", "install", "--disable-pip-version-check", "--force-reinstall", archive, "Pillow==" + pillowVersion}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return "", err
	}
	return binary, nil
}

func provisionSimforge(root string, runner commandRunner) (string, error) {
	cache := filepath.Join(root, ".tools-cache", "simforge-"+simforgeCommit)
	derivedData := filepath.Join(cache, "derived-data")
	product := filepath.Join(derivedData, "Build", "Products", "Release", "simforge")
	if err := os.MkdirAll(filepath.Dir(cache), 0o755); err != nil {
		return "", err
	}
	if _, err := os.Stat(cache); errors.Is(err, os.ErrNotExist) {
		if err := runner(root, "git", []string{"clone", simforgeRepository, cache}, os.Environ(), os.Stdout, os.Stderr); err != nil {
			return "", err
		}
		if err := runner(cache, "git", []string{"checkout", "--detach", simforgeCommit}, os.Environ(), os.Stdout, os.Stderr); err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	} else {
		revision, err := gitOutput(cache, runner, "rev-parse", "HEAD")
		if err != nil {
			return "", err
		}
		if strings.TrimSpace(revision) != simforgeCommit {
			return "", fmt.Errorf("simforge cache is not at pinned commit: %s", cache)
		}
		status, err := gitOutput(cache, runner, "status", "--porcelain", "--untracked-files=no")
		if err != nil {
			return "", err
		}
		if strings.TrimSpace(status) != "" {
			return "", fmt.Errorf("simforge cache has tracked changes: %s", cache)
		}
	}
	if executableExists(product) {
		return product, nil
	}
	if err := runXcodebuild(runner, cache, []string{"-project", "simforge.xcodeproj", "-scheme", "simforge", "-configuration", "Release", "-derivedDataPath", derivedData, "MACOSX_DEPLOYMENT_TARGET=12.0", "build"}); err != nil {
		return "", err
	}
	if !executableExists(product) {
		return "", fmt.Errorf("simforge build did not produce executable: %s", product)
	}
	return product, nil
}

func buildExtensions(options buildOptions, work string, runner commandRunner) ([]string, error) {
	if runtime.GOOS != "darwin" {
		return nil, errors.New("extensions require macOS")
	}
	paths := []string{}
	bundleBase := "com.hammerandchisel.discord"
	if options.channel == "testflight" {
		bundleBase += ".testflight"
	}
	for _, extension := range []struct{ name, target, product, module string }{
		{"OpenInDiscord", "OpenInDiscord Extension", "OpenInDiscord", "OpenInDiscordExt"},
		{"ShareToDiscord", "Share", "Share", "Share"},
	} {
		source := filepath.Join(iosRoot(options.root), "extensions", extension.name)
		destination := filepath.Join(work, "extensions", extension.name)
		if err := copyTree(source, destination); err != nil {
			return nil, err
		}
		if extension.name == "ShareToDiscord" {
			if err := rewritePlist(filepath.Join(destination, "Share", "Info.plist")); err != nil {
				return nil, err
			}
		}
		buildDir := filepath.Join(destination, "build")
		if err := os.MkdirAll(buildDir, 0o755); err != nil {
			return nil, err
		}
		project := extension.name + ".xcodeproj"
		args := []string{"-project", project, "build", "-target", extension.target, "-configuration", "Release", "-sdk", "iphoneos", "CONFIGURATION_BUILD_DIR=" + buildDir, "PRODUCT_NAME=" + extension.product, "PRODUCT_BUNDLE_IDENTIFIER=" + bundleBase + "." + extension.product, "PRODUCT_MODULE_NAME=" + extension.module, "SKIP_INSTALL=NO", "DEVELOPMENT_TEAM=", "CODE_SIGN_IDENTITY=", "CODE_SIGNING_REQUIRED=NO", "CODE_SIGNING_ALLOWED=NO", "ONLY_ACTIVE_ARCH=NO"}
		if err := runXcodebuild(runner, destination, args); err != nil {
			return nil, err
		}
		path := filepath.Join(buildDir, extension.product+".appex")
		if extension.name == "ShareToDiscord" {
			path = filepath.Join(buildDir, "Share.appex")
		}
		paths = append(paths, path)
	}
	return paths, nil
}

func xcbeautifyArguments(ci bool) []string {
	arguments := []string{"--disable-logging"}
	if ci {
		arguments = append(arguments, "--disable-colored-output")
	}
	return arguments
}

func runXcodebuild(runner commandRunner, directory string, args []string) error {
	formatter, err := exec.LookPath("xcbeautify")
	if err != nil {
		return runner(directory, "xcodebuild", args, os.Environ(), os.Stdout, os.Stderr)
	}
	beautify := exec.Command(formatter, xcbeautifyArguments(os.Getenv("CI") != "")...)
	beautify.Stdout = os.Stdout
	beautify.Stderr = os.Stderr
	input, err := beautify.StdinPipe()
	if err != nil {
		return err
	}
	if err := beautify.Start(); err != nil {
		return err
	}
	buildErr := runner(directory, "xcodebuild", args, os.Environ(), input, input)
	input.Close()
	if err := beautify.Wait(); err != nil && buildErr == nil {
		return fmt.Errorf("xcbeautify failed: %w", err)
	}
	return buildErr
}

func ipaExtensions(entries []string) map[string]struct{} {
	extensions := map[string]struct{}{}
	for _, entry := range entries {
		parts := strings.Split(entry, "/")
		if len(parts) != 5 || parts[0] != "Payload" || !strings.HasSuffix(parts[1], ".app") ||
			parts[2] != "PlugIns" || !strings.HasSuffix(parts[3], ".appex") || parts[4] != "Info.plist" {
			continue
		}
		extensions[parts[1]+"/"+strings.TrimSuffix(parts[3], ".appex")] = struct{}{}
	}
	return extensions
}

func validateIPAExtensions(sourceEntries, finalEntries []string) error {
	appName := "Discord.app"
	for _, entry := range sourceEntries {
		parts := strings.Split(entry, "/")
		if len(parts) >= 3 && parts[0] == "Payload" && strings.HasSuffix(parts[1], ".app") {
			appName = parts[1]
			break
		}
	}
	required := ipaExtensions(sourceEntries)
	required[appName+"/OpenInDiscord"] = struct{}{}
	required[appName+"/Share"] = struct{}{}
	installed := ipaExtensions(finalEntries)
	missing := []string{}
	for name := range required {
		if _, ok := installed[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	sort.Strings(missing)
	return fmt.Errorf("final IPA is missing required extensions: %s", strings.Join(missing, ", "))
}

func rejectLinkRelayApp(entries []string) error {
	for _, entry := range entries {
		for _, part := range strings.Split(entry, "/") {
			if part == linkRelayAppName {
				return fmt.Errorf("final IPA must not contain %s (Discord itself claims unbound:// in a sideloaded IPA): %s", linkRelayAppName, entry)
			}
		}
	}
	return nil
}

func validateIPAExtensionExecutables(path string) error {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer archive.Close()
	entries := make(map[string]*zip.File, len(archive.File))
	for _, file := range archive.File {
		entries[file.Name] = file
	}
	for _, file := range archive.File {
		parts := strings.Split(file.Name, "/")
		if len(parts) != 5 || parts[0] != "Payload" || !strings.HasSuffix(parts[1], ".app") ||
			parts[2] != "PlugIns" || !strings.HasSuffix(parts[3], ".appex") || parts[4] != "Info.plist" {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			return fmt.Errorf("could not read extension %s: %w", parts[3], err)
		}
		info, err := os.CreateTemp("", "loader-ipa-extension-*.plist")
		if err != nil {
			reader.Close()
			return err
		}
		_, copyErr := io.Copy(info, reader)
		readCloseErr := reader.Close()
		writeCloseErr := info.Close()
		if copyErr != nil || readCloseErr != nil || writeCloseErr != nil {
			os.Remove(info.Name())
			return fmt.Errorf("could not extract extension %s Info.plist: %w", parts[3], errors.Join(copyErr, readCloseErr, writeCloseErr))
		}
		executable, readErr := plistExecutable(info.Name())
		removeErr := os.Remove(info.Name())
		if readErr != nil {
			return fmt.Errorf("could not read extension %s executable: %w", parts[3], readErr)
		}
		if removeErr != nil {
			return removeErr
		}
		if executable == "" || filepath.Base(executable) != executable {
			return fmt.Errorf("extension %s has an invalid executable name %q", parts[3], executable)
		}
		binary := strings.TrimSuffix(file.Name, "Info.plist") + executable
		if candidate := entries[binary]; candidate == nil || candidate.UncompressedSize64 == 0 {
			return fmt.Errorf("final IPA is missing executable %s", binary)
		}
	}
	return nil
}

func rewritePlist(path string) error {
	if _, err := os.Stat(path); err != nil {
		return err
	}
	if err := exec.Command("/usr/libexec/PlistBuddy", "-c", "Set :URLScheme unbound", path).Run(); err == nil {
		return nil
	}
	return exec.Command("/usr/libexec/PlistBuddy", "-c", "Add :URLScheme string unbound", path).Run()
}

func rejectInjectedIPA(ipa, work string, runner commandRunner) error {
	info := filepath.Join(work, "Info.plist")
	if err := unzipEntry(ipa, "Payload/*.app/Info.plist", info, runner, "."); err != nil {
		return err
	}
	executable, err := plistExecutable(info)
	if err != nil {
		return err
	}
	entries, err := zipList(ipa, runner, ".")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if strings.HasSuffix(entry, ".app/"+executable) {
			binary := filepath.Join(work, "executable")
			if err := unzipEntry(ipa, entry, binary, runner, "."); err != nil {
				return err
			}
			output, _ := exec.Command("otool", "-L", binary).CombinedOutput()
			if strings.Contains(string(output), "Unbound.dylib") {
				return errors.New("input IPA already contains Unbound.dylib; use a clean Discord IPA")
			}
			return nil
		}
	}
	return nil
}

func verifyIPA(ipa, work string, runner commandRunner) error {
	verification := filepath.Join(work, "verify")
	if err := unzip(ipa, verification, runner, "."); err != nil {
		return err
	}
	dylib, err := findFile(filepath.Join(verification, "Payload"), "Unbound.dylib")
	if err != nil {
		return errors.New("final IPA contains no Unbound.dylib")
	}
	public, err := pinnedPublicKey()
	if err != nil {
		return err
	}
	if _, err := verifyFile(dylib, public); err != nil {
		return fmt.Errorf("final IPA contains an invalid embedded tweak attestation: %w", err)
	}
	return nil
}

func plistExecutable(path string) (string, error) {
	output, err := exec.Command("/usr/libexec/PlistBuddy", "-c", "Print :CFBundleExecutable", path).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("could not read IPA executable name: %s", strings.TrimSpace(string(output)))
	}
	return strings.TrimSpace(string(output)), nil
}

func unzip(path, destination string, runner commandRunner, root string) error {
	return runner(root, "unzip", []string{"-q", path, "-d", destination}, os.Environ(), os.Stdout, os.Stderr)
}

func unzipEntry(path, entry, destination string, runner commandRunner, root string) error {
	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()
	command := exec.Command("unzip", "-p", path, entry)
	command.Stdout = file
	command.Stderr = os.Stderr
	return command.Run()
}

func zipList(path string, runner commandRunner, root string) ([]string, error) {
	output, err := captureCommand(root, runner, "unzip", []string{"-Z1", path}, os.Environ())
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(output), "\n"), nil
}

func zipDirectory(payload, output string, runner commandRunner, root string) error {
	return runner(payload, "zip", []string{"-q", "-r", output, "Discord.app"}, os.Environ(), os.Stdout, os.Stderr)
}

func copyTree(source, destination string) error {
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode().Perm())
	})
}

func firstMatch(root, suffix string) (string, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return "", err
	}
	paths := []string{}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), suffix) {
			paths = append(paths, filepath.Join(root, entry.Name()))
		}
	}
	sort.Strings(paths)
	if len(paths) == 0 {
		return "", errors.New("no matching file")
	}
	return paths[0], nil
}

func toolsCommand() string {
	if value := os.Getenv("TOOLS_COMMAND"); value != "" {
		return value
	}
	value, err := os.Executable()
	if err == nil {
		return value
	}
	return "go run ./tools"
}

func executableExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir() && info.Mode()&0o111 != 0
}

func samePath(left, right string) bool {
	leftAbs, leftErr := filepath.Abs(left)
	rightAbs, rightErr := filepath.Abs(right)
	return leftErr == nil && rightErr == nil && filepath.Clean(leftAbs) == filepath.Clean(rightAbs)
}

func isTerminal(file *os.File) bool {
	info, err := file.Stat()
	return err == nil && info.Mode()&os.ModeCharDevice != 0
}

func defaultRunner(root, name string, args []string, env []string, stdout, stderr io.Writer) error {
	command := exec.Command(name, args...)
	command.Dir = root
	command.Env = env
	command.Stdout = stdout
	command.Stderr = stderr
	return command.Run()
}

func captureCommand(root string, runner commandRunner, name string, args []string, env []string) (string, error) {
	var output strings.Builder
	if err := runner(root, name, args, env, &output, os.Stderr); err != nil {
		return "", err
	}
	return output.String(), nil
}

func gitOutput(root string, runner commandRunner, args ...string) (string, error) {
	return captureCommand(root, runner, "git", args, os.Environ())
}
