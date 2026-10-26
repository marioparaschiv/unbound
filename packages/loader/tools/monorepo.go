package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
)

type workspaceManifest struct {
	Name     string            `json:"name"`
	Packages []workspaceModule `json:"packages"`
}

type workspaceModule struct {
	Name         string   `json:"name"`
	Path         string   `json:"path"`
	Kind         string   `json:"kind"`
	Dependencies []string `json:"dependencies"`
}

func runPlatform(args []string) error {
	if len(args) < 2 {
		return errors.New("usage: platform <build|test> <ios|android> [flags]")
	}

	set := flag.NewFlagSet("platform", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	configuration := set.String("configuration", "release", "debug or release")
	if err := set.Parse(args[2:]); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	if err := validateWorkspace(rootPath); err != nil {
		return err
	}
	return runPlatformWithRunner(args[0], args[1], rootPath, *configuration, defaultRunner)
}

func runPlatformWithRunner(action, platform, root, configuration string, runner commandRunner) error {
	if action != "build" && action != "test" {
		return fmt.Errorf("unknown platform action %q", action)
	}
	if platform != "ios" && platform != "android" {
		return fmt.Errorf("unknown platform %q", platform)
	}
	if configuration != "debug" && configuration != "release" {
		return errors.New("configuration must be debug or release")
	}

	if platform == "ios" {
		if action == "build" {
			return buildTweak(buildOptions{root: root, configuration: configuration}, runner)
		}
		return runGoAndCoreTests(root, runner)
	}

	if action == "build" {
		target := ":module:assembleRelease"
		if configuration == "debug" {
			target = ":module:assembleDebug"
		}
		return runner(filepath.Join(root, "android"), gradleCommand(), []string{target, "--no-daemon", "--quiet", "--console=plain"}, os.Environ(), os.Stdout, os.Stderr)
	}
	if err := runCoreTests(root, runner); err != nil {
		return err
	}
	return runner(filepath.Join(root, "android"), gradleCommand(), []string{":module:testDebugUnitTest", "--no-daemon", "--quiet", "--console=plain"}, os.Environ(), os.Stdout, os.Stderr)
}

func runValidate(args []string) error {
	set := flag.NewFlagSet("validate", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	if err := set.Parse(args); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	if err := validateWorkspace(rootPath); err != nil {
		return err
	}
	if err := runGoAndCoreTests(rootPath, defaultRunner); err != nil {
		return err
	}
	if err := defaultRunner(filepath.Join(rootPath, "android"), gradleCommand(), []string{":module:testDebugUnitTest", "--no-daemon", "--quiet", "--console=plain"}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	if err := defaultRunner(filepath.Join(rootPath, "android"), gradleCommand(), []string{":module:assembleRelease", "--no-daemon", "--quiet", "--console=plain"}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	if runtime.GOOS == "darwin" {
		return buildTweak(buildOptions{root: rootPath, configuration: "release"}, defaultRunner)
	}
	fmt.Println("skipping Theos build outside macOS")
	return nil
}

func runDependencies(args []string) error {
	set := flag.NewFlagSet("deps", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	if err := set.Parse(args); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	if err := validateWorkspace(rootPath); err != nil {
		return err
	}
	for _, path := range []string{"go.mod", "core/CMakeLists.txt", "android/gradlew", "ios/Makefile"} {
		if _, err := os.Stat(filepath.Join(rootPath, path)); err != nil {
			return fmt.Errorf("required repository path %s is unavailable: %w", path, err)
		}
	}
	var output bytes.Buffer
	if err := defaultRunner(rootPath, "git", []string{"submodule", "status", "--recursive"}, os.Environ(), &output, os.Stderr); err != nil {
		return err
	}
	if err := validateSubmoduleOutput(output.String()); err != nil {
		return err
	}
	fmt.Println("repository dependencies and submodule revisions are ready")
	return nil
}

func runPackages(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: packages <list|validate> [--root <path>]")
	}
	action := args[0]
	set := flag.NewFlagSet("packages", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	if err := set.Parse(args[1:]); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	manifest, err := readWorkspaceManifest(rootPath)
	if err != nil {
		return err
	}
	if err := validateWorkspaceManifest(rootPath, manifest); err != nil {
		return err
	}
	switch action {
	case "list":
		return printWorkspacePackages(os.Stdout, manifest.Packages)
	case "validate":
		fmt.Printf("workspace %s: %d packages are valid\n", manifest.Name, len(manifest.Packages))
		return nil
	default:
		return fmt.Errorf("unknown packages action %q", action)
	}
}

func validateWorkspace(root string) error {
	manifest, err := readWorkspaceManifest(root)
	if err != nil {
		return err
	}
	return validateWorkspaceManifest(root, manifest)
}

func readWorkspaceManifest(root string) (workspaceManifest, error) {
	data, err := os.ReadFile(filepath.Join(root, "manifest.json"))
	if err != nil {
		return workspaceManifest{}, fmt.Errorf("read manifest.json: %w", err)
	}
	var manifest workspaceManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return workspaceManifest{}, fmt.Errorf("decode manifest.json: %w", err)
	}
	return manifest, nil
}

func validateWorkspaceManifest(root string, manifest workspaceManifest) error {
	if strings.TrimSpace(manifest.Name) == "" {
		return errors.New("workspace name is required")
	}
	if len(manifest.Packages) == 0 {
		return errors.New("workspace must contain at least one package")
	}
	knownNames := make(map[string]struct{}, len(manifest.Packages))
	knownPaths := make(map[string]struct{}, len(manifest.Packages))
	for _, module := range manifest.Packages {
		if strings.TrimSpace(module.Name) == "" || strings.TrimSpace(module.Kind) == "" {
			return errors.New("every package must have a name and kind")
		}
		if !workspacePath(module.Path) {
			return fmt.Errorf("package %s must be a path inside the loader root: %s", module.Name, module.Path)
		}
		if _, exists := knownNames[module.Name]; exists {
			return fmt.Errorf("duplicate workspace package name %q", module.Name)
		}
		if _, exists := knownPaths[module.Path]; exists {
			return fmt.Errorf("duplicate workspace package path %q", module.Path)
		}
		knownNames[module.Name] = struct{}{}
		knownPaths[module.Path] = struct{}{}
		if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(module.Path))); err != nil {
			return fmt.Errorf("package %s path %s is unavailable: %w", module.Name, module.Path, err)
		}
	}
	for _, module := range manifest.Packages {
		for _, dependency := range module.Dependencies {
			if _, exists := knownNames[dependency]; !exists {
				return fmt.Errorf("package %s has unknown dependency %q", module.Name, dependency)
			}
		}
	}
	if err := validateWorkspaceDependencyGraph(manifest.Packages); err != nil {
		return err
	}
	return validateWorkspaceTopLevel(root, knownPaths)
}

var loaderSupportDirectories = map[string]struct{}{"build": {}, "docs": {}, "tools": {}, "workflow-tests": {}}

func workspacePath(path string) bool {
	clean := filepath.ToSlash(filepath.Clean(path))
	return path == clean && clean != "." && !filepath.IsAbs(path) && clean != ".." && !strings.HasPrefix(clean, "../")
}

func validateWorkspaceDependencyGraph(packages []workspaceModule) error {
	byName := make(map[string]workspaceModule, len(packages))
	for _, module := range packages {
		byName[module.Name] = module
	}
	states := make(map[string]uint8, len(packages))
	var visit func(string) error
	visit = func(name string) error {
		if states[name] == 1 {
			return fmt.Errorf("workspace dependency cycle includes %q", name)
		}
		if states[name] == 2 {
			return nil
		}
		states[name] = 1
		for _, dependency := range byName[name].Dependencies {
			if err := visit(dependency); err != nil {
				return err
			}
		}
		states[name] = 2
		return nil
	}
	for _, module := range packages {
		if err := visit(module.Name); err != nil {
			return err
		}
	}
	return nil
}

func validateWorkspaceTopLevel(root string, knownPaths map[string]struct{}) error {
	entries, err := os.ReadDir(root)
	if err != nil {
		return fmt.Errorf("read the loader root: %w", err)
	}
	knownTopLevel := make(map[string]struct{}, len(knownPaths))
	for path := range knownPaths {
		parts := strings.Split(filepath.ToSlash(path), "/")
		knownTopLevel[parts[0]] = struct{}{}
	}
	tracked, hasTracked := trackedTopLevelDirectories(root)
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		if _, isTracked := tracked[entry.Name()]; hasTracked && !isTracked {
			continue
		}
		if _, support := loaderSupportDirectories[entry.Name()]; support {
			continue
		}
		if _, exists := knownTopLevel[entry.Name()]; !exists {
			return fmt.Errorf("%s is not registered in manifest.json", entry.Name())
		}
	}
	return nil
}

func trackedTopLevelDirectories(root string) (map[string]struct{}, bool) {
	var output bytes.Buffer
	if err := defaultRunner(root, "git", []string{"ls-files", "-z", "--", "."}, os.Environ(), &output, io.Discard); err != nil {
		return nil, false
	}
	directories := map[string]struct{}{}
	for _, path := range strings.Split(output.String(), "\x00") {
		if index := strings.Index(path, "/"); index > 0 {
			directories[path[:index]] = struct{}{}
		}
	}
	return directories, len(directories) > 0
}

func printWorkspacePackages(output io.Writer, packages []workspaceModule) error {
	ordered := append([]workspaceModule(nil), packages...)
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].Name < ordered[j].Name })
	for _, module := range ordered {
		dependencies := append([]string(nil), module.Dependencies...)
		sort.Strings(dependencies)
		fmt.Fprintf(output, "%s\t%s\t%s", module.Name, module.Kind, module.Path)
		if len(dependencies) > 0 {
			fmt.Fprintf(output, "\tdepends on: %s", strings.Join(dependencies, ", "))
		}
		fmt.Fprintln(output)
	}
	return nil
}

func runGoAndCoreTests(root string, runner commandRunner) error {
	if err := runner(root, "go", []string{"test", "-count=1", "./..."}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	return runCoreTests(root, runner)
}

func runCoreTests(root string, runner commandRunner) error {
	buildPath := filepath.Join(root, "build", "shared-core")
	configureArgs := []string{"-S", "core", "-B", buildPath, "-DUNBOUND_CORE_TESTS=ON", "-DCMAKE_BUILD_TYPE=Debug"}
	if runtime.GOOS != "windows" {
		configureArgs = append(configureArgs, "-DCMAKE_CXX_FLAGS=-fsanitize=address,undefined")
	}
	if err := runner(root, "cmake", configureArgs, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	if err := runner(root, "cmake", []string{"--build", buildPath, "--parallel"}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	return runner(root, "ctest", []string{"--test-dir", buildPath, "--output-on-failure"}, os.Environ(), os.Stdout, os.Stderr)
}

func gradleCommand() string {
	if runtime.GOOS == "windows" {
		return "gradlew.bat"
	}
	return "./gradlew"
}

func validateSubmoduleOutput(output string) error {
	for _, line := range strings.Split(output, "\n") {
		if strings.HasPrefix(line, "-") || strings.HasPrefix(line, "+") || strings.HasPrefix(line, "U") {
			return fmt.Errorf("submodule checkout is not pinned to the recorded revision: %s", line)
		}
	}
	return nil
}
