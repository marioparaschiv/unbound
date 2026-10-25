package main

import (
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

type sdkObjCType struct {
	Name      string
	Super     string
	Protocols []string
	Methods   map[string]bool
}

type iosSDKIndex struct {
	Classes   map[string]*sdkObjCType
	Protocols map[string]*sdkObjCType
	Selectors map[string]bool
	Exported  map[string]bool
}

func newIOSSDKIndex() *iosSDKIndex {
	return &iosSDKIndex{
		Classes:   map[string]*sdkObjCType{},
		Protocols: map[string]*sdkObjCType{},
		Selectors: map[string]bool{},
		Exported:  map[string]bool{},
	}
}

var (
	sdkInterfacePattern = regexp.MustCompile(`@interface\s+(\w+)\s*(?:<[^>]*>)?\s*(?::\s*(\w+))?\s*(?:\(\s*\w*\s*\))?\s*(?:<([^>]*)>)?`)
	sdkProtocolPattern  = regexp.MustCompile(`@protocol\s+(\w+)\s*(?:<([^>]*)>)?`)
	sdkTBDClassesBlock  = regexp.MustCompile(`objc-classes:\s*\[([^\]]*)\]`)
	sdkSelectorPart     = regexp.MustCompile(`^\s*(\w+)\s*:`)
	sdkIdentifier       = regexp.MustCompile(`\w+`)
	sdkBlockProperty    = regexp.MustCompile(`\(\s*\^\s*(?:_Nullable|_Nonnull|nullable|nonnull)?\s*(\w+)\s*\)`)
	sdkMacroCall        = regexp.MustCompile(`\b\w+\s*\([^()]*(?:\([^()]*\)[^()]*)*\)`)
)

func discoverIOSSDK() string {
	output, err := exec.Command("xcrun", "--sdk", "iphoneos", "--show-sdk-path").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func loadIOSSDKIndex(sdk string) (*iosSDKIndex, error) {
	index := newIOSSDKIndex()
	for _, root := range []string{filepath.Join(sdk, "usr", "include", "objc"), filepath.Join(sdk, "System", "Library", "Frameworks")} {
		if err := index.addDirectory(root); err != nil {
			return nil, err
		}
	}
	return index, nil
}

func (index *iosSDKIndex) addDirectory(root string) error {
	return index.walk(root, map[string]bool{})
}

func (index *iosSDKIndex) walk(root string, visited map[string]bool) error {
	if visited[root] {
		return nil
	}
	visited[root] = true
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.Type()&fs.ModeSymlink != 0 {
			target, err := filepath.EvalSymlinks(path)
			if err != nil {
				return nil
			}
			if info, err := os.Stat(target); err == nil && info.IsDir() {
				return index.walk(target, visited)
			}
			path = target
		} else if entry.IsDir() {
			return nil
		}
		switch filepath.Ext(path) {
		case ".h":
			if !strings.Contains(path, "/Headers/") && !strings.Contains(path, "/include/objc/") {
				return nil
			}
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			index.addHeader(string(content))
		case ".tbd":
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			index.addTBD(string(content))
		}
		return nil
	})
}

func (index *iosSDKIndex) addTBD(content string) {
	for _, match := range sdkTBDClassesBlock.FindAllStringSubmatch(content, -1) {
		for _, name := range strings.Split(match[1], ",") {
			name = strings.Trim(strings.TrimSpace(name), "'\"")
			if name != "" {
				index.Exported[name] = true
			}
		}
	}
}

func stripObjCComments(source string) string {
	var builder strings.Builder
	for position := 0; position < len(source); {
		switch {
		case strings.HasPrefix(source[position:], "//"):
			end := strings.IndexByte(source[position:], '\n')
			if end < 0 {
				return builder.String()
			}
			position += end
		case strings.HasPrefix(source[position:], "/*"):
			end := strings.Index(source[position+2:], "*/")
			if end < 0 {
				return builder.String()
			}
			builder.WriteString(strings.Repeat("\n", strings.Count(source[position:position+2+end], "\n")))
			position += end + 4
		default:
			builder.WriteByte(source[position])
			position++
		}
	}
	return builder.String()
}

func splitObjCList(list string) []string {
	var names []string
	for _, part := range strings.Split(list, ",") {
		if name := strings.TrimSpace(part); name != "" {
			names = append(names, name)
		}
	}
	return names
}

func stripPreprocessorLines(source string) string {
	lines := strings.Split(source, "\n")
	for number, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "#") {
			lines[number] = ""
		}
	}
	return strings.Join(lines, "\n")
}

func (index *iosSDKIndex) addHeader(source string) {
	source = stripPreprocessorLines(stripObjCComments(source))
	for position := 0; position < len(source); {
		at := strings.IndexByte(source[position:], '@')
		if at < 0 {
			return
		}
		position += at
		rest := source[position:]
		var owner *sdkObjCType
		var header string
		switch {
		case strings.HasPrefix(rest, "@interface"):
			match := sdkInterfacePattern.FindStringSubmatch(rest)
			if match == nil {
				position++
				continue
			}
			header = match[0]
			owner = index.Classes[match[1]]
			if owner == nil {
				owner = &sdkObjCType{Name: match[1], Methods: map[string]bool{}}
				index.Classes[match[1]] = owner
			}
			if match[2] != "" {
				owner.Super = match[2]
			}
			owner.Protocols = append(owner.Protocols, splitObjCList(match[3])...)
		case strings.HasPrefix(rest, "@protocol"):
			match := sdkProtocolPattern.FindStringSubmatch(rest)
			if match == nil {
				position++
				continue
			}
			after := strings.TrimSpace(rest[len(match[0]):])
			if strings.HasPrefix(after, ";") || strings.HasPrefix(after, ",") || strings.HasPrefix(rest[len("@protocol"):], "(") {
				position += len(match[0])
				continue
			}
			header = match[0]
			owner = index.Protocols[match[1]]
			if owner == nil {
				owner = &sdkObjCType{Name: match[1], Methods: map[string]bool{}}
				index.Protocols[match[1]] = owner
			}
			owner.Protocols = append(owner.Protocols, splitObjCList(match[2])...)
		default:
			position++
			continue
		}
		body := rest[len(header):]
		end := strings.Index(body, "@end")
		if end < 0 {
			end = len(body)
		}
		index.addDeclarations(owner, body[:end])
		position += len(header) + end
	}
}

func (index *iosSDKIndex) addDeclarations(owner *sdkObjCType, body string) {
	if strings.HasPrefix(strings.TrimSpace(body), "{") {
		if close := strings.IndexByte(body, '}'); close >= 0 {
			body = body[close+1:]
		}
	}
	for _, statement := range strings.Split(body, ";") {
		statement = strings.TrimSpace(statement)
		for strings.HasPrefix(statement, "@optional") || strings.HasPrefix(statement, "@required") {
			statement = strings.TrimSpace(statement[len("@optional"):])
		}
		switch {
		case strings.HasPrefix(statement, "-") || strings.HasPrefix(statement, "+"):
			if selector := objcDeclaredSelector(statement[1:]); selector != "" {
				owner.Methods[selector] = true
				index.Selectors[selector] = true
			}
		case strings.HasPrefix(statement, "@property"):
			for _, selector := range objcPropertySelectors(statement) {
				owner.Methods[selector] = true
				index.Selectors[selector] = true
			}
		}
	}
}

func skipBalanced(text string, open, close byte) string {
	text = strings.TrimSpace(text)
	if !strings.HasPrefix(text, string(open)) {
		return text
	}
	depth := 0
	for position := 0; position < len(text); position++ {
		switch text[position] {
		case open:
			depth++
		case close:
			depth--
			if depth == 0 {
				return text[position+1:]
			}
		}
	}
	return ""
}

func objcDeclaredSelector(declaration string) string {
	rest := skipBalanced(declaration, '(', ')')
	first := sdkIdentifier.FindStringIndex(rest)
	if first == nil || strings.TrimSpace(rest[:first[0]]) != "" {
		return ""
	}
	name := rest[first[0]:first[1]]
	rest = rest[first[1]:]
	if !strings.HasPrefix(strings.TrimSpace(rest), ":") {
		return name
	}
	selector := ""
	rest = name + rest
	for {
		match := sdkSelectorPart.FindStringSubmatchIndex(rest)
		if match == nil {
			break
		}
		selector += rest[match[2]:match[3]] + ":"
		rest = skipBalanced(rest[match[1]:], '(', ')')
		argument := sdkIdentifier.FindStringIndex(rest)
		if argument == nil || strings.TrimSpace(rest[:argument[0]]) != "" {
			break
		}
		rest = rest[argument[1]:]
	}
	return selector
}

func objcPropertySelectors(statement string) []string {
	rest := strings.TrimSpace(strings.TrimPrefix(statement, "@property"))
	attributes := ""
	if strings.HasPrefix(rest, "(") {
		after := skipBalanced(rest, '(', ')')
		attributes = rest[1 : len(rest)-len(after)-1]
		rest = after
	}
	name := ""
	if block := sdkBlockProperty.FindStringSubmatch(rest); block != nil {
		name = block[1]
	} else {
		cleaned := sdkMacroCall.ReplaceAllString(rest, " ")
		for _, word := range sdkIdentifier.FindAllString(cleaned, -1) {
			if word == strings.ToUpper(word) && strings.ContainsAny(word, "_") {
				continue
			}
			name = word
		}
	}
	if name == "" {
		return nil
	}
	getter, setter, readonly := name, "set"+strings.ToUpper(name[:1])+name[1:]+":", false
	for _, attribute := range strings.Split(attributes, ",") {
		attribute = strings.TrimSpace(attribute)
		switch {
		case attribute == "readonly":
			readonly = true
		case strings.HasPrefix(attribute, "getter="):
			getter = strings.TrimSpace(strings.TrimPrefix(attribute, "getter="))
		case strings.HasPrefix(attribute, "setter="):
			setter = strings.TrimSpace(strings.TrimPrefix(attribute, "setter="))
		}
	}
	if readonly {
		return []string{getter}
	}
	return []string{getter, setter}
}

func (index *iosSDKIndex) hasClass(name string) bool {
	return index.Classes[name] != nil || index.Exported[name]
}

func (index *iosSDKIndex) protocolDeclares(name, selector string, visited map[string]bool) bool {
	protocol := index.Protocols[name]
	if protocol == nil || visited["@"+name] {
		return false
	}
	visited["@"+name] = true
	if protocol.Methods[selector] {
		return true
	}
	for _, inherited := range protocol.Protocols {
		if index.protocolDeclares(inherited, selector, visited) {
			return true
		}
	}
	return false
}

func (index *iosSDKIndex) declares(className, selector string) (bool, string) {
	visited := map[string]bool{}
	for current := index.Classes[className]; current != nil && !visited[current.Name]; current = index.Classes[current.Super] {
		visited[current.Name] = true
		if current.Methods[selector] {
			return true, current.Name
		}
		for _, protocol := range current.Protocols {
			if index.protocolDeclares(protocol, selector, visited) {
				return true, current.Name
			}
		}
	}
	return false, ""
}
