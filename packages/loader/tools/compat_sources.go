package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	referenceModulePath = "module-path"
	referenceProps      = "props"
	referencePrototypes = "prototypes"
	referenceStore      = "store"
	referenceName       = "name"
	referenceObjCClass  = "objc-class"
	referenceObjCMethod = "objc-method"
	referenceObjCIvar   = "objc-ivar"
	referenceJavaClass  = "java-class"
	referenceJavaMethod = "java-method"
	referenceJavaField  = "java-field"
)

type compatLocation struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

type compatReference struct {
	Kind       string           `json:"kind"`
	Platform   string           `json:"platform,omitempty"`
	Component  string           `json:"component"`
	Class      string           `json:"class,omitempty"`
	Name       string           `json:"name,omitempty"`
	Terms      []string         `json:"terms,omitempty"`
	Parameters []string         `json:"parameters,omitempty"`
	Strict     bool             `json:"strict,omitempty"`
	Locations  []compatLocation `json:"locations"`
}

func (reference compatReference) key() string {
	parts := []string{reference.Kind, reference.Class, reference.Name, strings.Join(reference.Terms, ","), strings.Join(reference.Parameters, ",")}
	return strings.Join(parts, "|")
}

func (reference compatReference) platforms() []string {
	switch reference.Kind {
	case referenceObjCClass, referenceObjCMethod, referenceObjCIvar:
		return []string{"ios"}
	case referenceJavaClass, referenceJavaMethod, referenceJavaField:
		return []string{"android"}
	}
	if reference.Platform != "" {
		return []string{reference.Platform}
	}
	return []string{"ios", "android"}
}

type compatDynamicSite struct {
	Component string         `json:"component"`
	Call      string         `json:"call"`
	Location  compatLocation `json:"location"`
}

type compatSourceSet struct {
	references   map[string]*compatReference
	dynamic      map[string]int
	dynamicSites []compatDynamicSite
}

func newCompatSourceSet() *compatSourceSet {
	return &compatSourceSet{references: map[string]*compatReference{}, dynamic: map[string]int{}}
}

func (set *compatSourceSet) add(reference compatReference, location compatLocation) {
	identity := reference.Component + "#" + reference.Platform + "#" + reference.key()
	if existing := set.references[identity]; existing != nil {
		existing.Strict = existing.Strict || reference.Strict
		for _, known := range existing.Locations {
			if known == location {
				return
			}
		}
		existing.Locations = append(existing.Locations, location)
		return
	}
	reference.Locations = []compatLocation{location}
	set.references[identity] = &reference
}

func (set *compatSourceSet) sorted() []*compatReference {
	references := make([]*compatReference, 0, len(set.references))
	for _, reference := range set.references {
		references = append(references, reference)
	}
	sort.Slice(references, func(left, right int) bool {
		a, b := references[left], references[right]
		if a.Component != b.Component {
			return a.Component < b.Component
		}
		if a.Locations[0].File != b.Locations[0].File {
			return a.Locations[0].File < b.Locations[0].File
		}
		if a.Locations[0].Line != b.Locations[0].Line {
			return a.Locations[0].Line < b.Locations[0].Line
		}
		return a.key() < b.key()
	})
	return references
}

type compatSourceFile struct {
	path      string
	component string
	platform  string
}

func compatComponent(relative string) (string, bool) {
	parts := strings.Split(relative, "/")
	switch {
	case strings.HasPrefix(relative, "packages/loader/ios/sources/"):
		return "loader-ios", true
	case strings.HasPrefix(relative, "packages/loader/android/module/src/main/"):
		return "loader-android", true
	case strings.HasPrefix(relative, "packages/client/src/"):
		return "client", true
	case strings.HasPrefix(relative, "packages/plugins-shared/src/"):
		return "plugins-shared", true
	case len(parts) > 3 && parts[0] == "packages" && parts[1] == "plugins" && parts[3] == "src":
		return "plugin:" + parts[2], true
	}
	return "", false
}

func compatPlatform(relative string) string {
	segments := strings.Split(relative, "/")
	for _, segment := range segments {
		switch segment {
		case "ios":
			return "ios"
		case "android":
			return "android"
		}
	}
	base := filepath.Base(relative)
	switch {
	case strings.Contains(base, ".ios."):
		return "ios"
	case strings.Contains(base, ".android."):
		return "android"
	}
	return ""
}

func isCompatTestPath(relative string) bool {
	return strings.Contains(relative, "/tests/") || strings.Contains(relative, "/__tests__/") ||
		strings.Contains(relative, ".test.") || strings.Contains(relative, ".spec.") ||
		strings.HasSuffix(relative, ".d.ts")
}

func collectCompatReferences(root string) (*compatSourceSet, error) {
	var files []compatSourceFile
	err := filepath.WalkDir(filepath.Join(root, "packages"), func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			switch entry.Name() {
			case "node_modules", "dist", "build", ".theos", "vendor", ".gradle":
				return filepath.SkipDir
			}
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		relative = filepath.ToSlash(relative)
		component, ok := compatComponent(relative)
		if !ok || isCompatTestPath(relative) {
			return nil
		}
		switch filepath.Ext(relative) {
		case ".ts", ".tsx", ".x", ".xm", ".m", ".mm", ".kt", ".cpp", ".h":
			files = append(files, compatSourceFile{path: relative, component: component, platform: compatPlatform(relative)})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	set := newCompatSourceSet()
	var scripts []*scriptFile
	for _, file := range files {
		content, err := os.ReadFile(filepath.Join(root, file.path))
		if err != nil {
			return nil, err
		}
		switch filepath.Ext(file.path) {
		case ".ts", ".tsx":
			scripts = append(scripts, newScriptFile(file, scriptSourceRoot(file.path), tokenizeScript(string(content))))
		default:
			extractNativeReferences(set, file, string(content))
		}
	}
	analyzeScripts(set, scripts)
	return set, nil
}

type compatTokenKind int

const (
	tokenIdentifier compatTokenKind = iota
	tokenString
	tokenPunctuation
	tokenOther
)

type compatToken struct {
	kind  compatTokenKind
	value string
	line  int
}

func tokenizeScript(source string) []compatToken {
	var tokens []compatToken
	line := 1
	regexAllowed := true
	for index := 0; index < len(source); {
		character := source[index]
		switch {
		case character == '\n':
			line++
			index++
		case character == ' ' || character == '\t' || character == '\r':
			index++
		case strings.HasPrefix(source[index:], "//"):
			for index < len(source) && source[index] != '\n' {
				index++
			}
		case strings.HasPrefix(source[index:], "/*"):
			end := strings.Index(source[index+2:], "*/")
			if end < 0 {
				return tokens
			}
			line += strings.Count(source[index:index+2+end], "\n")
			index += end + 4
		case character == '\'' || character == '"':
			value, next, ok := readQuoted(source, index)
			if ok {
				tokens = append(tokens, compatToken{kind: tokenString, value: value, line: line})
				regexAllowed = false
			}
			index = next
		case character == '`':
			start := index
			index++
			for index < len(source) && source[index] != '`' {
				if source[index] == '\\' {
					index++
				}
				index++
			}
			body := source[start+1 : min(index, len(source))]
			line += strings.Count(body, "\n")
			index++
			kind := tokenOther
			if !strings.Contains(body, "${") {
				kind = tokenString
			}
			tokens = append(tokens, compatToken{kind: kind, value: body, line: line})
			regexAllowed = false
		case character == '/' && regexAllowed:
			index++
			inClass := false
			for index < len(source) && source[index] != '\n' {
				if source[index] == '\\' {
					index += 2
					continue
				}
				if source[index] == '[' {
					inClass = true
				} else if source[index] == ']' {
					inClass = false
				} else if source[index] == '/' && !inClass {
					index++
					break
				}
				index++
			}
			tokens = append(tokens, compatToken{kind: tokenOther, value: "/regex/", line: line})
			regexAllowed = false
		case isIdentifierStart(character):
			start := index
			for index < len(source) && isIdentifierPart(source[index]) {
				index++
			}
			word := source[start:index]
			tokens = append(tokens, compatToken{kind: tokenIdentifier, value: word, line: line})
			regexAllowed = word == "return" || word == "typeof" || word == "case" || word == "in" || word == "of"
		case character >= '0' && character <= '9':
			start := index
			for index < len(source) && (isIdentifierPart(source[index]) || source[index] == '.') {
				index++
			}
			tokens = append(tokens, compatToken{kind: tokenOther, value: source[start:index], line: line})
			regexAllowed = false
		default:
			tokens = append(tokens, compatToken{kind: tokenPunctuation, value: string(character), line: line})
			regexAllowed = !strings.ContainsRune(")]}", rune(character))
			index++
		}
	}
	return tokens
}

func readQuoted(source string, start int) (string, int, bool) {
	quote := source[start]
	var builder strings.Builder
	for index := start + 1; index < len(source); index++ {
		switch source[index] {
		case '\\':
			if index+1 < len(source) {
				builder.WriteByte(source[index+1])
			}
			index++
		case '\n':
			return "", index, false
		case quote:
			return builder.String(), index + 1, true
		default:
			builder.WriteByte(source[index])
		}
	}
	return "", len(source), false
}

func isIdentifierStart(character byte) bool {
	return character == '_' || character == '$' || (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
}

func isIdentifierPart(character byte) bool {
	return isIdentifierStart(character) || (character >= '0' && character <= '9')
}

var (
	javaClassPattern      = regexp.MustCompile(`^(?:com|androidx|android|java|javax|kotlin|kotlinx|org|io|dalvik)\.(?:[a-z0-9_]+\.)+[A-Z][A-Za-z0-9_$]*$`)
	modulePathPattern     = regexp.MustCompile(`^(?:[a-z_][A-Za-z0-9_-]*/)+[A-Za-z0-9_.\-\[\]]+\.(?:tsx|ts|jsx|js)$`)
	discordObjCClassRegex = regexp.MustCompile(`^(?:(?:DCD|RCT|RN)[A-Z][A-Za-z0-9_]*|Discord[A-Za-z0-9_]*\.[A-Z][A-Za-z0-9_.]*)$`)
)

var scriptLookupCalls = map[string]string{
	"findByProps": referenceProps, "findByPropsLazy": referenceProps, "byProps": referenceProps,
	"findByPrototypes": referencePrototypes, "findByPrototypesLazy": referencePrototypes, "byPrototypes": referencePrototypes,
	"findStore": referenceStore, "findStoreLazy": referenceStore, "byStore": referenceStore,
	"findByName": referenceName, "findByNameLazy": referenceName, "byName": referenceName,
	"findByDisplayName": referenceName, "findByDisplayNameLazy": referenceName, "byDisplayName": referenceName,
	"findByFilePath": referenceModulePath, "findByFilePathLazy": referenceModulePath, "byFilePath": referenceModulePath,
}

var (
	logosHookPattern       = regexp.MustCompile(`^%hook\s+([A-Za-z_][A-Za-z0-9_.]*)`)
	logosMethodPattern     = regexp.MustCompile(`^[-+]\s*\([^)]*\)\s*([A-Za-z_][A-Za-z0-9_]*)(.*)$`)
	logosSelectorPart      = regexp.MustCompile(`([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\(`)
	logosFirstPart         = regexp.MustCompile(`^\s*:`)
	objcStringClassPattern = regexp.MustCompile(`(?:NSClassFromString\(@"|objc_getClass\(")([A-Za-z_][A-Za-z0-9_.]*)"`)
	logosClassPattern      = regexp.MustCompile(`%c\(([A-Za-z_][A-Za-z0-9_.]*)\)`)
	kotlinStringPattern    = regexp.MustCompile(`"((?:com|androidx|android|java|javax|kotlin|org|io|dalvik)\.[A-Za-z0-9_.$]+)"`)
	kotlinMethodPattern    = regexp.MustCompile(`get(?:Declared)?Method\("([A-Za-z_$][A-Za-z0-9_$-]*)"`)
	kotlinFieldPattern     = regexp.MustCompile(`get(?:Declared)?Field\("([A-Za-z_$][A-Za-z0-9_$]*)"`)
	jniClassPattern        = regexp.MustCompile(`FindClass\("([A-Za-z0-9_/$]+)"`)
)

func logosSelector(name, rest string) string {
	if !logosFirstPart.MatchString(rest) {
		return name
	}
	selector := name + ":"
	for _, match := range logosSelectorPart.FindAllStringSubmatch(rest, -1) {
		selector += match[1] + ":"
	}
	return selector
}

func extractNativeReferences(set *compatSourceSet, file compatSourceFile, content string) {
	base := compatReference{Component: file.component, Platform: file.platform}
	hooked := ""
	lines := strings.Split(content, "\n")
	for number, line := range lines {
		location := compatLocation{File: file.path, Line: number + 1}
		trimmed := strings.TrimSpace(line)
		if hooked != "" && (strings.HasPrefix(trimmed, "-") || strings.HasPrefix(trimmed, "+")) {
			for next := number + 1; next < len(lines) && !strings.ContainsAny(trimmed, "{;"); next++ {
				trimmed += " " + strings.TrimSpace(lines[next])
			}
		}
		add := func(kind, class, name string) {
			reference := base
			reference.Kind, reference.Class, reference.Name = kind, class, name
			set.add(reference, location)
		}

		switch filepath.Ext(file.path) {
		case ".x", ".xm", ".m", ".mm", ".h":
			if match := logosHookPattern.FindStringSubmatch(trimmed); match != nil {
				hooked = match[1]
				reference := base
				reference.Kind, reference.Name, reference.Strict = referenceObjCClass, hooked, true
				set.add(reference, location)
				continue
			}
			if strings.HasPrefix(trimmed, "%end") {
				hooked = ""
				continue
			}
			if hooked != "" {
				if match := logosMethodPattern.FindStringSubmatch(trimmed); match != nil {
					add(referenceObjCMethod, hooked, logosSelector(match[1], match[2]))
				}
			}
			for _, match := range objcStringClassPattern.FindAllStringSubmatch(line, -1) {
				add(referenceObjCClass, "", match[1])
			}
			for _, match := range logosClassPattern.FindAllStringSubmatch(line, -1) {
				add(referenceObjCClass, "", match[1])
			}
		case ".kt":
			for _, match := range kotlinStringPattern.FindAllStringSubmatch(line, -1) {
				if javaClassPattern.MatchString(match[1]) {
					add(referenceJavaClass, "", match[1])
				}
			}
			for _, match := range kotlinMethodPattern.FindAllStringSubmatch(line, -1) {
				add(referenceJavaMethod, "", match[1])
			}
			for _, match := range kotlinFieldPattern.FindAllStringSubmatch(line, -1) {
				add(referenceJavaField, "", match[1])
			}
		case ".cpp":
			for _, match := range jniClassPattern.FindAllStringSubmatch(line, -1) {
				add(referenceJavaClass, "", strings.ReplaceAll(match[1], "/", "."))
			}
		}
	}
}
