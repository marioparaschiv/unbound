package main

import (
	"encoding/binary"
	"errors"
	"strings"
)

const dexNoIndex = 0xFFFFFFFF

type dexClass struct {
	Name    string
	Super   string
	Methods map[string][]string
	Fields  map[string]bool
}

type dexIndex struct {
	Classes     map[string]*dexClass
	MethodNames map[string]bool
	FieldNames  map[string]bool
}

func newDexIndex() *dexIndex {
	return &dexIndex{
		Classes:     map[string]*dexClass{},
		MethodNames: map[string]bool{},
		FieldNames:  map[string]bool{},
	}
}

type dexLookup int

const (
	dexFound dexLookup = iota
	dexMissing
	dexSignatureMismatch
	dexInheritedExternally
)

func (index *dexIndex) lookupMethod(className, method, parameters string) (dexLookup, string) {
	visited := map[string]bool{}
	nameSeen := false
	current := index.Classes[className]
	last := className
	for current != nil && !visited[current.Name] {
		visited[current.Name] = true
		if signatures, ok := current.Methods[method]; ok {
			if parameters == "" {
				return dexFound, current.Name
			}
			for _, signature := range signatures {
				if signature == parameters {
					return dexFound, current.Name
				}
			}
			nameSeen = true
		}
		last = current.Super
		current = index.Classes[current.Super]
	}
	if nameSeen {
		return dexSignatureMismatch, ""
	}
	if last != "" && index.Classes[last] == nil {
		return dexInheritedExternally, last
	}
	return dexMissing, ""
}

func (index *dexIndex) lookupField(className, field string) (dexLookup, string) {
	visited := map[string]bool{}
	current := index.Classes[className]
	last := className
	for current != nil && !visited[current.Name] {
		visited[current.Name] = true
		if current.Fields[field] {
			return dexFound, current.Name
		}
		last = current.Super
		current = index.Classes[current.Super]
	}
	if last != "" && index.Classes[last] == nil {
		return dexInheritedExternally, last
	}
	return dexMissing, ""
}

type dexFile struct {
	data    []byte
	strings []string
	types   []string
	protos  []string
	fields  [][2]string
	methods []dexMethodID
}

type dexMethodID struct {
	class, name, parameters string
}

func readUleb128(data []byte, offset int) (uint32, int, error) {
	var result uint32
	for shift := 0; shift < 35; shift += 7 {
		if offset >= len(data) {
			return 0, offset, errors.New("uleb128 out of range")
		}
		value := data[offset]
		offset++
		result |= uint32(value&0x7F) << shift
		if value&0x80 == 0 {
			return result, offset, nil
		}
	}
	return 0, offset, errors.New("uleb128 too long")
}

func addDexToIndex(index *dexIndex, data []byte) error {
	if len(data) < 0x70 || !strings.HasPrefix(string(data[:4]), "dex\n") {
		return errors.New("not a dex file")
	}
	file := &dexFile{data: data}
	order := binary.LittleEndian
	table := func(offset int) (int, int) {
		return int(order.Uint32(data[offset:])), int(order.Uint32(data[offset+4:]))
	}
	bounded := func(offset, count, width int) bool {
		return offset >= 0 && count >= 0 && offset+count*width <= len(data)
	}

	stringCount, stringOffset := table(0x38)
	typeCount, typeOffset := table(0x40)
	protoCount, protoOffset := table(0x48)
	fieldCount, fieldOffset := table(0x50)
	methodCount, methodOffset := table(0x58)
	classCount, classOffset := table(0x60)
	if !bounded(stringOffset, stringCount, 4) || !bounded(typeOffset, typeCount, 4) ||
		!bounded(protoOffset, protoCount, 12) || !bounded(fieldOffset, fieldCount, 8) ||
		!bounded(methodOffset, methodCount, 8) || !bounded(classOffset, classCount, 32) {
		return errors.New("dex tables out of range")
	}

	file.strings = make([]string, stringCount)
	for index := range file.strings {
		position := int(order.Uint32(data[stringOffset+4*index:]))
		_, start, err := readUleb128(data, position)
		if err != nil {
			return err
		}
		end := start
		for end < len(data) && data[end] != 0 {
			end++
		}
		file.strings[index] = string(data[start:end])
	}

	text := func(index uint32) string {
		if int(index) < len(file.strings) {
			return file.strings[index]
		}
		return ""
	}

	file.types = make([]string, typeCount)
	for index := range file.types {
		file.types[index] = text(order.Uint32(data[typeOffset+4*index:]))
	}
	typeName := func(index uint32) string {
		if int(index) < len(file.types) {
			return file.types[index]
		}
		return ""
	}

	file.protos = make([]string, protoCount)
	for index := range file.protos {
		parameters := int(order.Uint32(data[protoOffset+12*index+8:]))
		var builder strings.Builder
		if parameters != 0 && parameters+4 <= len(data) {
			count := int(order.Uint32(data[parameters:]))
			for item := 0; item < count && parameters+4+2*item+2 <= len(data); item++ {
				builder.WriteString(typeName(uint32(order.Uint16(data[parameters+4+2*item:]))))
			}
		}
		file.protos[index] = builder.String()
	}

	file.fields = make([][2]string, fieldCount)
	for item := range file.fields {
		base := fieldOffset + 8*item
		class := javaClassName(typeName(uint32(order.Uint16(data[base:]))))
		name := text(order.Uint32(data[base+4:]))
		file.fields[item] = [2]string{class, name}
		index.FieldNames[name] = true
	}

	file.methods = make([]dexMethodID, methodCount)
	for item := range file.methods {
		base := methodOffset + 8*item
		method := dexMethodID{
			class: javaClassName(typeName(uint32(order.Uint16(data[base:])))),
			name:  text(order.Uint32(data[base+4:])),
		}
		if proto := int(order.Uint16(data[base+2:])); proto < len(file.protos) {
			method.parameters = file.protos[proto]
		}
		file.methods[item] = method
		index.MethodNames[method.name] = true
	}

	for item := 0; item < classCount; item++ {
		base := classOffset + 32*item
		class := &dexClass{
			Name:    javaClassName(typeName(order.Uint32(data[base:]))),
			Methods: map[string][]string{},
			Fields:  map[string]bool{},
		}
		if super := order.Uint32(data[base+8:]); super != dexNoIndex {
			class.Super = javaClassName(typeName(super))
		}
		if classData := int(order.Uint32(data[base+24:])); classData != 0 {
			if err := file.readClassData(classData, class); err != nil {
				return err
			}
		}
		if existing := index.Classes[class.Name]; existing != nil {
			continue
		}
		index.Classes[class.Name] = class
	}
	return nil
}

func (file *dexFile) readClassData(offset int, class *dexClass) error {
	var counts [4]uint32
	var err error
	for item := range counts {
		if counts[item], offset, err = readUleb128(file.data, offset); err != nil {
			return err
		}
	}
	for group := 0; group < 2; group++ {
		var fieldIndex uint32
		for item := uint32(0); item < counts[group]; item++ {
			var difference uint32
			if difference, offset, err = readUleb128(file.data, offset); err != nil {
				return err
			}
			if _, offset, err = readUleb128(file.data, offset); err != nil {
				return err
			}
			fieldIndex += difference
			if int(fieldIndex) < len(file.fields) {
				class.Fields[file.fields[fieldIndex][1]] = true
			}
		}
	}
	for group := 2; group < 4; group++ {
		var methodIndex uint32
		for item := uint32(0); item < counts[group]; item++ {
			var difference uint32
			if difference, offset, err = readUleb128(file.data, offset); err != nil {
				return err
			}
			for skip := 0; skip < 2; skip++ {
				if _, offset, err = readUleb128(file.data, offset); err != nil {
					return err
				}
			}
			methodIndex += difference
			if int(methodIndex) < len(file.methods) {
				method := file.methods[methodIndex]
				class.Methods[method.name] = append(class.Methods[method.name], method.parameters)
			}
		}
	}
	return nil
}

func javaClassName(descriptor string) string {
	if strings.HasPrefix(descriptor, "L") && strings.HasSuffix(descriptor, ";") {
		return strings.ReplaceAll(descriptor[1:len(descriptor)-1], "/", ".")
	}
	return descriptor
}

var javaPrimitiveDescriptors = map[string]string{
	"boolean": "Z", "byte": "B", "char": "C", "short": "S", "int": "I",
	"long": "J", "float": "F", "double": "D", "void": "V",
}

func javaTypeDescriptor(name string) string {
	dimensions := 0
	for strings.HasSuffix(name, "[]") {
		name = strings.TrimSuffix(name, "[]")
		dimensions++
	}
	descriptor, ok := javaPrimitiveDescriptors[name]
	if !ok {
		descriptor = "L" + strings.ReplaceAll(name, ".", "/") + ";"
	}
	return strings.Repeat("[", dimensions) + descriptor
}

func javaParameterDescriptors(names []string) string {
	var builder strings.Builder
	for _, name := range names {
		builder.WriteString(javaTypeDescriptor(name))
	}
	return builder.String()
}
