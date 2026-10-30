package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const ownJavaPrefix = "app.astral."

var (
	kotlinPackagePattern     = regexp.MustCompile(`(?m)^\s*package\s+([\w.]+)`)
	kotlinDeclarationPattern = regexp.MustCompile(`^(?:companion\s+object|class|object|interface)\b(?:\s+(\w+))?`)
	kotlinFunctionPattern    = regexp.MustCompile(`^fun\s+(?:<[^>]*>\s*)?(?:[\w.<>?]+\.)?(\w+)\s*\(`)
	kotlinPropertyPattern    = regexp.MustCompile(`^(val|var)\s+(?:[\w.<>?]+\.)?(\w+)`)
)

func isOwnJavaName(name string) bool {
	return strings.HasPrefix(name, ownJavaPrefix)
}

func loadOwnJavaIndex(root string) (*javaFrameworkIndex, error) {
	index := newJavaFrameworkIndex()
	sources := filepath.Join(root, "packages", "loader", "android", "module", "src", "main")
	err := filepath.WalkDir(sources, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || filepath.Ext(path) != ".kt" {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, class := range parseKotlinClasses(string(content)) {
			index.add(class)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return index, nil
}

func stripKotlinLiterals(source string) string {
	var builder strings.Builder
	for position := 0; position < len(source); {
		switch {
		case strings.HasPrefix(source[position:], "//"):
			for position < len(source) && source[position] != '\n' {
				position++
			}
		case strings.HasPrefix(source[position:], "/*"):
			end := strings.Index(source[position+2:], "*/")
			if end < 0 {
				return builder.String()
			}
			position += end + 4
		case strings.HasPrefix(source[position:], `"""`):
			end := strings.Index(source[position+3:], `"""`)
			if end < 0 {
				return builder.String()
			}
			builder.WriteString(`""`)
			position += end + 6
		case source[position] == '"' || source[position] == '\'':
			quote := source[position]
			position++
			for position < len(source) && source[position] != quote && source[position] != '\n' {
				if source[position] == '\\' {
					position++
				}
				position++
			}
			position++
			builder.WriteString(`""`)
		default:
			builder.WriteByte(source[position])
			position++
		}
	}
	return builder.String()
}

type kotlinScope struct {
	class *javaFrameworkClass
	depth int
}

func parseKotlinClasses(source string) []*javaFrameworkClass {
	packageName := ""
	if match := kotlinPackagePattern.FindStringSubmatch(source); match != nil {
		packageName = match[1]
	}
	source = stripKotlinLiterals(source)
	var classes []*javaFrameworkClass
	var stack []kotlinScope
	var pending *javaFrameworkClass
	depth := 0
	for position := 0; position < len(source); position++ {
		character := source[position]
		switch character {
		case '{':
			depth++
			if pending != nil {
				stack = append(stack, kotlinScope{class: pending, depth: depth})
				pending = nil
			}
			continue
		case '}':
			if len(stack) > 0 && stack[len(stack)-1].depth == depth {
				stack = stack[:len(stack)-1]
			}
			depth--
			continue
		}
		if !isIdentifierStart(character) || position > 0 && isIdentifierPart(source[position-1]) {
			continue
		}
		rest := source[position:]
		if match := kotlinDeclarationPattern.FindStringSubmatch(rest); match != nil {
			name := match[1]
			if name == "" && strings.HasPrefix(match[0], "companion") {
				name = "Companion"
			}
			if name == "" {
				continue
			}
			fullName := packageName + "." + name
			if len(stack) > 0 {
				fullName = stack[len(stack)-1].class.Name + "$" + name
			}
			class := &javaFrameworkClass{Name: fullName, Methods: map[string][]string{}, Fields: map[string]bool{}}
			if strings.Contains(match[0], "object") {
				class.Fields["INSTANCE"] = true
			}
			if len(stack) > 0 && strings.HasPrefix(match[0], "companion") {
				stack[len(stack)-1].class.Fields["Companion"] = true
			}
			classes = append(classes, class)
			if kotlinHasBody(rest[len(match[0]):]) {
				pending = class
			}
			position += len(match[0]) - 1
			continue
		}
		if len(stack) == 0 || stack[len(stack)-1].depth != depth {
			continue
		}
		owner := stack[len(stack)-1].class
		if match := kotlinFunctionPattern.FindStringSubmatch(rest); match != nil {
			owner.Methods[match[1]] = append(owner.Methods[match[1]], "")
			position += len(match[0]) - 1
			continue
		}
		if match := kotlinPropertyPattern.FindStringSubmatch(rest); match != nil {
			name := match[2]
			owner.Fields[name] = true
			capitalized := strings.ToUpper(name[:1]) + name[1:]
			getter := "get" + capitalized
			if strings.HasPrefix(name, "is") && len(name) > 2 && name[2] >= 'A' && name[2] <= 'Z' {
				getter = name
			}
			owner.Methods[getter] = append(owner.Methods[getter], "")
			if match[1] == "var" {
				owner.Methods["set"+capitalized] = append(owner.Methods["set"+capitalized], "")
			}
			position += len(match[0]) - 1
		}
	}
	return classes
}

func kotlinHasBody(rest string) bool {
	parens := 0
	for position := 0; position < len(rest); position++ {
		switch rest[position] {
		case '(', '<':
			parens++
		case ')', '>':
			parens--
		case '{':
			if parens <= 0 {
				return true
			}
		case '}', ';':
			if parens <= 0 {
				return false
			}
		case '\n':
			if parens > 0 {
				continue
			}
			before := strings.TrimSpace(rest[:position])
			after := strings.TrimSpace(rest[position:])
			if strings.HasSuffix(before, ":") || strings.HasSuffix(before, ",") || strings.HasPrefix(after, ":") || strings.HasPrefix(after, "{") || strings.HasPrefix(after, ",") {
				continue
			}
			return false
		}
	}
	return false
}
