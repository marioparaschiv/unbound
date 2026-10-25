package main

import (
	"archive/zip"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type javaFrameworkClass struct {
	Name       string
	Super      string
	Interfaces []string
	Methods    map[string][]string
	Fields     map[string]bool
}

type javaFrameworkIndex struct {
	Classes     map[string]*javaFrameworkClass
	MethodNames map[string]bool
	FieldNames  map[string]bool
}

func newJavaFrameworkIndex() *javaFrameworkIndex {
	return &javaFrameworkIndex{
		Classes:     map[string]*javaFrameworkClass{},
		MethodNames: map[string]bool{},
		FieldNames:  map[string]bool{},
	}
}

func discoverAndroidJar() string {
	var homes []string
	for _, variable := range []string{"ANDROID_HOME", "ANDROID_SDK_ROOT"} {
		if value := os.Getenv(variable); value != "" {
			homes = append(homes, value)
		}
	}
	if home, err := os.UserHomeDir(); err == nil {
		homes = append(homes, filepath.Join(home, "Library", "Android", "sdk"), filepath.Join(home, "Android", "Sdk"))
	}
	for _, home := range homes {
		matches, _ := filepath.Glob(filepath.Join(home, "platforms", "android-*", "android.jar"))
		best, bestLevel := "", -1
		for _, match := range matches {
			level, err := strconv.Atoi(strings.TrimPrefix(filepath.Base(filepath.Dir(match)), "android-"))
			if err == nil && level > bestLevel {
				best, bestLevel = match, level
			}
		}
		if best != "" {
			return best
		}
	}
	return ""
}

func loadJavaFrameworkIndex(path string) (*javaFrameworkIndex, error) {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return nil, err
	}
	defer archive.Close()
	index := newJavaFrameworkIndex()
	for _, file := range archive.File {
		if !strings.HasSuffix(file.Name, ".class") {
			continue
		}
		data, err := readZipEntry(file)
		if err != nil {
			return nil, err
		}
		class, err := parseJavaClassFile(data)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", file.Name, err)
		}
		index.add(class)
	}
	return index, nil
}

func (index *javaFrameworkIndex) add(class *javaFrameworkClass) {
	index.Classes[class.Name] = class
	for name := range class.Methods {
		index.MethodNames[name] = true
	}
	for name := range class.Fields {
		index.FieldNames[name] = true
	}
}

type javaClassReader struct {
	data     []byte
	position int
	err      error
}

func (reader *javaClassReader) u1() int {
	if reader.err != nil || reader.position+1 > len(reader.data) {
		reader.err = errors.New("class file is truncated")
		return 0
	}
	value := reader.data[reader.position]
	reader.position++
	return int(value)
}

func (reader *javaClassReader) u2() int {
	if reader.err != nil || reader.position+2 > len(reader.data) {
		reader.err = errors.New("class file is truncated")
		return 0
	}
	value := binary.BigEndian.Uint16(reader.data[reader.position:])
	reader.position += 2
	return int(value)
}

func (reader *javaClassReader) u4() int {
	if reader.err != nil || reader.position+4 > len(reader.data) {
		reader.err = errors.New("class file is truncated")
		return 0
	}
	value := binary.BigEndian.Uint32(reader.data[reader.position:])
	reader.position += 4
	return int(value)
}

func (reader *javaClassReader) skip(count int) {
	if reader.err != nil || count < 0 || reader.position+count > len(reader.data) {
		reader.err = errors.New("class file is truncated")
		return
	}
	reader.position += count
}

func parseJavaClassFile(data []byte) (*javaFrameworkClass, error) {
	reader := &javaClassReader{data: data}
	if reader.u4() != 0xCAFEBABE {
		return nil, errors.New("not a class file")
	}
	reader.skip(4)
	count := reader.u2()
	utf8 := make([]string, count)
	classes := make([]int, count)
	for slot := 1; slot < count && reader.err == nil; slot++ {
		switch tag := reader.u1(); tag {
		case 1:
			length := reader.u2()
			start := reader.position
			reader.skip(length)
			if reader.err == nil {
				utf8[slot] = string(data[start : start+length])
			}
		case 7:
			classes[slot] = reader.u2()
		case 8, 16, 19, 20:
			reader.skip(2)
		case 15:
			reader.skip(3)
		case 3, 4, 9, 10, 11, 12, 17, 18:
			reader.skip(4)
		case 5, 6:
			reader.skip(8)
			slot++
		default:
			return nil, fmt.Errorf("unknown constant pool tag %d", tag)
		}
	}
	text := func(slot int) string {
		if slot > 0 && slot < len(utf8) {
			return utf8[slot]
		}
		return ""
	}
	className := func(slot int) string {
		if slot > 0 && slot < len(classes) {
			return strings.ReplaceAll(text(classes[slot]), "/", ".")
		}
		return ""
	}
	reader.skip(2)
	class := &javaFrameworkClass{Methods: map[string][]string{}, Fields: map[string]bool{}}
	class.Name = className(reader.u2())
	class.Super = className(reader.u2())
	for interfaces := reader.u2(); interfaces > 0 && reader.err == nil; interfaces-- {
		class.Interfaces = append(class.Interfaces, className(reader.u2()))
	}
	members := func(record func(name, descriptor string)) {
		for members := reader.u2(); members > 0 && reader.err == nil; members-- {
			reader.skip(2)
			name := text(reader.u2())
			descriptor := text(reader.u2())
			for attributes := reader.u2(); attributes > 0 && reader.err == nil; attributes-- {
				reader.skip(2)
				reader.skip(reader.u4())
			}
			record(name, descriptor)
		}
	}
	members(func(name, _ string) { class.Fields[name] = true })
	members(func(name, descriptor string) {
		class.Methods[name] = append(class.Methods[name], javaDescriptorParameters(descriptor))
	})
	if reader.err != nil {
		return nil, reader.err
	}
	return class, nil
}

func javaDescriptorParameters(descriptor string) string {
	if !strings.HasPrefix(descriptor, "(") {
		return ""
	}
	if end := strings.IndexByte(descriptor, ')'); end > 0 {
		return descriptor[1:end]
	}
	return ""
}

func (index *javaFrameworkIndex) lookupMethod(className, method, parameters string) (dexLookup, string) {
	visited := map[string]bool{}
	nameSeen := false
	queue := []string{className}
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]
		class := index.Classes[name]
		if class == nil || visited[name] {
			continue
		}
		visited[name] = true
		if signatures, ok := class.Methods[method]; ok {
			if parameters == "" {
				return dexFound, name
			}
			for _, signature := range signatures {
				if signature == parameters {
					return dexFound, name
				}
			}
			nameSeen = true
		}
		if class.Super != "" {
			queue = append(queue, class.Super)
		}
		queue = append(queue, class.Interfaces...)
	}
	if nameSeen {
		return dexSignatureMismatch, ""
	}
	return dexMissing, ""
}

func (index *javaFrameworkIndex) lookupField(className, field string) bool {
	visited := map[string]bool{}
	queue := []string{className}
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]
		class := index.Classes[name]
		if class == nil || visited[name] {
			continue
		}
		visited[name] = true
		if class.Fields[field] {
			return true
		}
		if class.Super != "" {
			queue = append(queue, class.Super)
		}
		queue = append(queue, class.Interfaces...)
	}
	return false
}

func (index *javaFrameworkIndex) classNames() []string {
	names := make([]string, 0, len(index.Classes))
	for name := range index.Classes {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
