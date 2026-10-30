package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var formatSourceRoots = []string{
	"core/src",
	"core/include",
	"core/tests",
	"android/module/src/main/cpp",
	"ios/sources",
	"ios/headers",
}

var formatSourceExtensions = map[string]string{
	".c":   ".c",
	".cc":  ".cc",
	".cpp": ".cpp",
	".h":   ".h",
	".hpp": ".hpp",
	".m":   ".m",
	".mm":  ".mm",
	".x":   ".m",
	".xm":  ".mm",
}

const logosPragma = "#pragma astral_logos "

var vendoredSourceDirectories = []string{"ios/headers/ReactCommon"}

const vendoredLicenseMarker = "Copyright (c) Meta Platforms"

var (
	logosDirectiveLine = regexp.MustCompile(`^\s*%(hook|end|ctor|dtor|group|subclass|new|property|hookf|config)\b`)
	logosInline        = map[string]string{
		"%orig": "_LOrg",
		"%init": "_LInt",
		"%c(":   "_LC(",
	}
	includeLine = regexp.MustCompile(`^\s*#\s*(import|include)\b`)
)

func runFormat(args []string) error {
	set := flag.NewFlagSet("format", flag.ContinueOnError)
	root := set.String("root", ".", "loader root")
	check := set.Bool("check", false, "report unformatted files instead of rewriting them")
	set.Usage = func() { fmt.Fprintln(set.Output(), "usage: go run ./tools format [--check] [--root <path>] [file...]") }
	if err := set.Parse(args); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}

	only, err := selectedFiles(set.Args())
	if err != nil {
		return err
	}

	var failures []string
	if only == nil || only.hasExtension(formatSourceExtensions) {
		unformatted, err := formatNativeSources(rootPath, *check, only)
		if err != nil {
			return err
		}
		failures = append(failures, unformatted...)
	}

	if only == nil || only.hasExtension(map[string]string{".go": ".go"}) {
		goFiles, err := formatGoSources(rootPath, *check)
		if err != nil {
			return err
		}
		failures = append(failures, goFiles...)
	}

	if only == nil || only.hasExtension(map[string]string{".kt": ".kt", ".kts": ".kts"}) {
		if err := runKotlinFormatter(rootPath, *check, only.withExtensions(".kt", ".kts")); err != nil {
			failures = append(failures, "Kotlin sources ("+err.Error()+")")
		}
	}

	if len(failures) > 0 {
		sort.Strings(failures)
		return fmt.Errorf("unformatted loader sources; run `bun run loader:fmt`:\n  %s", strings.Join(failures, "\n  "))
	}
	return nil
}

func runLint(args []string) error {
	set := flag.NewFlagSet("lint", flag.ContinueOnError)
	root := set.String("root", ".", "loader root")
	if err := set.Parse(args); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}

	if err := runQuiet(rootPath, "go", "vet", "./tools"); err != nil {
		return fmt.Errorf("go vet: %w", err)
	}
	if err := runQuiet(filepath.Join(rootPath, workflowTestsModule), "go", "vet", "./..."); err != nil {
		return fmt.Errorf("go vet %s: %w", workflowTestsModule, err)
	}
	if err := runKotlinLinter(rootPath); err != nil {
		return fmt.Errorf("ktlint: %w", err)
	}
	if err := lintWorkflows(rootPath); err != nil {
		return fmt.Errorf("actionlint: %w", err)
	}
	return runFormat([]string{"--root", rootPath, "--check"})
}

func nativeSourceFiles(root string) ([]string, error) {
	var files []string
	for _, directory := range formatSourceRoots {
		err := filepath.Walk(filepath.Join(root, directory), func(path string, info os.FileInfo, err error) error {
			if err != nil {
				if errors.Is(err, os.ErrNotExist) {
					return nil
				}
				return err
			}
			if info.IsDir() {
				rel, _ := filepath.Rel(root, path)
				if strings.HasPrefix(info.Name(), ".") || info.Name() == "build" || isVendoredDirectory(rel) {
					return filepath.SkipDir
				}
				return nil
			}
			if _, ok := formatSourceExtensions[filepath.Ext(path)]; ok {
				files = append(files, path)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	sort.Strings(files)
	return files, nil
}

const clangFormatVersion = "23.1."

type fileSelection map[string]bool

func selectedFiles(paths []string) (fileSelection, error) {
	if len(paths) == 0 {
		return nil, nil
	}
	selection := fileSelection{}
	for _, path := range paths {
		absolute, err := filepath.Abs(path)
		if err != nil {
			return nil, err
		}
		selection[absolute] = true
	}
	return selection, nil
}

func (selection fileSelection) hasExtension(extensions map[string]string) bool {
	for path := range selection {
		if _, ok := extensions[filepath.Ext(path)]; ok {
			return true
		}
	}
	return false
}

func isVendoredDirectory(rel string) bool {
	for _, directory := range vendoredSourceDirectories {
		if rel == directory {
			return true
		}
	}
	return false
}

func formatNativeSources(root string, check bool, only fileSelection) ([]string, error) {
	if err := requireClangFormat(); err != nil {
		return nil, err
	}

	files, err := nativeSourceFiles(root)
	if err != nil {
		return nil, err
	}

	var unformatted []string
	for _, path := range files {
		if only != nil && !only[path] {
			continue
		}
		original, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		if strings.Contains(string(original), vendoredLicenseMarker) {
			continue
		}
		formatted, err := formatNativeSource(root, path, original)
		if err != nil {
			return nil, err
		}
		if bytes.Equal(original, formatted) {
			continue
		}
		rel, _ := filepath.Rel(root, path)
		if check {
			unformatted = append(unformatted, rel)
			continue
		}
		if err := os.WriteFile(path, formatted, 0o644); err != nil {
			return nil, err
		}
	}
	return unformatted, nil
}

func requireClangFormat() error {
	output, err := exec.Command("clang-format", "--version").Output()
	if err != nil {
		return errors.New("clang-format " + clangFormatVersion + "x is required; install it with `pip install clang-format==23.1.3`")
	}
	if !strings.Contains(string(output), "version "+clangFormatVersion) {
		return fmt.Errorf("clang-format %sx is required, found %s", clangFormatVersion, strings.TrimSpace(string(output)))
	}
	return nil
}

func formatNativeSource(root, path string, original []byte) ([]byte, error) {
	isLogos := filepath.Ext(path) == ".x" || filepath.Ext(path) == ".xm"
	input := original
	if isLogos {
		protected, err := protectLogos(original)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		input = protected
	}

	assumed := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)) + formatSourceExtensions[filepath.Ext(path)]
	command := exec.Command("clang-format", "--style=file:"+filepath.Join(root, ".clang-format"), "--assume-filename="+assumed)
	command.Stdin = bytes.NewReader(input)
	var output, errorOutput bytes.Buffer
	command.Stdout = &output
	command.Stderr = &errorOutput
	if err := command.Run(); err != nil {
		return nil, fmt.Errorf("clang-format %s: %v: %s", path, err, errorOutput.String())
	}

	formatted := output.Bytes()
	if isLogos {
		restored, err := restoreLogos(formatted, original)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		formatted = restored
		if !sameTokens(original, formatted) || strings.Join(logosDirectives(original), "\n") != strings.Join(logosDirectives(formatted), "\n") {
			return nil, fmt.Errorf("%s: formatting would change Logos code, not just whitespace", path)
		}
	}
	return formatted, nil
}

func protectLogos(source []byte) ([]byte, error) {
	for _, placeholder := range logosInline {
		if strings.Contains(string(source), placeholder) {
			return nil, fmt.Errorf("source already contains the placeholder %s", placeholder)
		}
	}
	if strings.Contains(string(source), logosPragma) {
		return nil, fmt.Errorf("source already contains %q", strings.TrimSpace(logosPragma))
	}

	lines := strings.Split(string(source), "\n")
	directive := 0
	for index, line := range lines {
		if logosDirectiveLine.MatchString(line) {
			lines[index] = fmt.Sprintf("%s%d", logosPragma, directive)
			directive++
			continue
		}
		lines[index] = replaceOutsideLiterals(line, logosInline)
	}
	return []byte(strings.Join(lines, "\n")), nil
}

func logosDirectives(source []byte) []string {
	var directives []string
	for _, line := range strings.Split(string(source), "\n") {
		if logosDirectiveLine.MatchString(line) {
			directives = append(directives, strings.TrimSpace(line))
		}
	}
	return directives
}

func restoreLogos(formatted []byte, original []byte) ([]byte, error) {
	directives := logosDirectives(original)
	lines := strings.Split(string(formatted), "\n")
	used := 0
	for index, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, logosPragma) {
			var position int
			if _, err := fmt.Sscanf(strings.TrimPrefix(trimmed, logosPragma), "%d", &position); err != nil || position != used || position >= len(directives) {
				return nil, errors.New("clang-format moved or rewrote a Logos directive")
			}
			lines[index] = directives[position]
			used++
			continue
		}
		for directive, placeholder := range logosInline {
			lines[index] = strings.ReplaceAll(lines[index], placeholder, directive)
		}
	}
	if used != len(directives) {
		return nil, errors.New("clang-format dropped a Logos directive")
	}
	return []byte(strings.Join(lines, "\n")), nil
}

func replaceOutsideLiterals(line string, replacements map[string]string) string {
	var result strings.Builder
	inString := false
	for index := 0; index < len(line); {
		character := line[index]
		if inString {
			result.WriteByte(character)
			if character == '\\' && index+1 < len(line) {
				result.WriteByte(line[index+1])
				index += 2
				continue
			}
			if character == '"' {
				inString = false
			}
			index++
			continue
		}
		if character == '"' {
			inString = true
			result.WriteByte(character)
			index++
			continue
		}
		if strings.HasPrefix(line[index:], "//") {
			result.WriteString(line[index:])
			break
		}
		replaced := false
		for directive, placeholder := range replacements {
			if strings.HasPrefix(line[index:], directive) && !continuesIdentifier(line, index+len(directive), directive) {
				result.WriteString(placeholder)
				index += len(directive)
				replaced = true
				break
			}
		}
		if !replaced {
			result.WriteByte(character)
			index++
		}
	}
	return result.String()
}

func continuesIdentifier(line string, next int, directive string) bool {
	if strings.HasSuffix(directive, "(") || next >= len(line) {
		return false
	}
	character := line[next]
	return character == '_' || character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z' || character >= '0' && character <= '9'
}

func sameTokens(original, formatted []byte) bool {
	strip := func(source []byte) (string, []string) {
		var code strings.Builder
		var includes []string
		for _, line := range strings.Split(string(source), "\n") {
			if includeLine.MatchString(line) {
				includes = append(includes, strings.Join(strings.Fields(line), ""))
				continue
			}
			code.WriteString(strings.Join(strings.Fields(line), ""))
		}
		sort.Strings(includes)
		return code.String(), includes
	}
	originalCode, originalIncludes := strip(original)
	formattedCode, formattedIncludes := strip(formatted)
	return originalCode == formattedCode && strings.Join(originalIncludes, "\n") == strings.Join(formattedIncludes, "\n")
}

const workflowTestsModule = "workflow-tests"

func formatGoSources(root string, check bool) ([]string, error) {
	mode := "-w"
	if check {
		mode = "-l"
	}
	command := exec.Command("gofmt", mode, "tools", workflowTestsModule)
	command.Dir = root
	output, err := command.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("gofmt: %v: %s", err, output)
	}
	if !check {
		return nil, nil
	}
	var files []string
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		if line != "" {
			files = append(files, line)
		}
	}
	return files, nil
}

func (selection fileSelection) withExtensions(extensions ...string) []string {
	var files []string
	for path := range selection {
		for _, extension := range extensions {
			if filepath.Ext(path) == extension {
				files = append(files, path)
			}
		}
	}
	sort.Strings(files)
	return files
}

func runKotlinFormatter(root string, check bool, files []string) error {
	task := ":module:ktlintFormat"
	if check {
		task = ":module:ktlintCheck"
	}
	if len(files) == 0 {
		return runGradle(root, task)
	}
	return runGradle(root, task, "-PktlintFiles="+strings.Join(files, ","))
}

func runKotlinLinter(root string) error {
	return runGradle(root, ":module:ktlintCheck")
}

func runGradle(root, task string, arguments ...string) error {
	command := exec.Command("./gradlew", append([]string{"--quiet", task}, arguments...)...)
	command.Dir = filepath.Join(root, "android")
	command.Env = androidEnvironment()
	var output bytes.Buffer
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Run(); err != nil {
		return fmt.Errorf("%s failed:\n%s", task, strings.TrimSpace(output.String()))
	}
	return nil
}

func androidEnvironment() []string {
	environment := os.Environ()
	if os.Getenv("ANDROID_HOME") != "" {
		return environment
	}
	if home, err := os.UserHomeDir(); err == nil {
		sdk := filepath.Join(home, "Library", "Android", "sdk")
		if _, err := os.Stat(sdk); err == nil {
			environment = append(environment, "ANDROID_HOME="+sdk)
		}
	}
	return environment
}

func lintWorkflows(root string) error {
	binary, err := exec.LookPath("actionlint")
	if err != nil {
		return errors.New("actionlint is required to lint the GitHub workflows")
	}
	workflows, err := filepath.Glob(filepath.Join(root, "..", "..", ".github", "workflows", "*.yml"))
	if err != nil || len(workflows) == 0 {
		return err
	}
	return runQuiet(root, binary, workflows...)
}

func runQuiet(directory, name string, args ...string) error {
	command := exec.Command(name, args...)
	command.Dir = directory
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%v:\n%s", err, strings.TrimSpace(string(output)))
	}
	return nil
}
