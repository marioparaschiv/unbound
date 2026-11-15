package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var (
	swiftObjCClassPattern  = regexp.MustCompile(`@objc\((\w+)\)\s*(?:(?:public|internal|final|open)\s+)*class\s+\w+\s*:\s*(\w+)`)
	swiftObjCMethodPattern = regexp.MustCompile(`@objc(?:\(([\w:]+)\))?\s+(?:(?:public|internal|static|class|final|open|dynamic)\s+)*func\s+(\w+)\s*\(([^)]*)\)`)
)

func loadOwnObjCClasses(root string) ([]*objcClass, error) {
	var classes []*objcClass

	sources := filepath.Join(root, "packages", "loader", "ios")

	err := filepath.WalkDir(sources, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if entry.IsDir() && entry.Name() == "extensions" {
			return filepath.SkipDir
		}

		if entry.IsDir() || filepath.Ext(path) != ".swift" {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		classes = append(classes, parseSwiftObjCClasses(string(content))...)

		return nil
	})
	if err != nil {
		return nil, err
	}

	return classes, nil
}

func parseSwiftObjCClasses(source string) []*objcClass {
	var classes []*objcClass

	matches := swiftObjCClassPattern.FindAllStringSubmatchIndex(source, -1)
	for position, match := range matches {
		end := len(source)
		if position+1 < len(matches) {
			end = matches[position+1][0]
		}

		class := &objcClass{
			Name:          source[match[2]:match[3]],
			Super:         source[match[4]:match[5]],
			SuperExternal: true,
			Methods:       map[string]bool{},
			Ivars:         map[string]bool{},
		}

		for _, method := range swiftObjCMethodPattern.FindAllStringSubmatch(source[match[1]:end], -1) {
			selector := method[1]
			if selector == "" {
				selector = swiftSelector(method[2], method[3])
			}

			class.Methods[selector] = true
		}

		classes = append(classes, class)
	}

	return classes
}

func swiftSelector(name, parameters string) string {
	parameters = strings.TrimSpace(parameters)
	if parameters == "" {
		return name
	}

	var builder strings.Builder

	builder.WriteString(name)

	for index, parameter := range strings.Split(parameters, ",") {
		label := strings.Fields(strings.SplitN(parameter, ":", 2)[0])
		if len(label) == 0 {
			continue
		}

		switch {
		case index > 0:
			builder.WriteString(label[0])
		case label[0] != "_":
			builder.WriteString(strings.ToUpper(label[0][:1]) + label[0][1:])
		}

		builder.WriteString(":")
	}

	return builder.String()
}

func mergeOwnObjCClasses(index *objcIndex, classes []*objcClass) {
	for _, class := range classes {
		if index.Classes[class.Name] == nil {
			index.Classes[class.Name] = class
		}

		for selector := range class.Methods {
			index.Classes[class.Name].Methods[selector] = true
			index.Selectors[selector] = true
		}
	}
}
