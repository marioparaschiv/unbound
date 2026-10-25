package main

import (
	"bytes"
	"debug/macho"
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const loadCommandChainedFixups = 0x80000034

type objcClass struct {
	Name          string
	Super         string
	SuperExternal bool
	Methods       map[string]bool
	Ivars         map[string]bool
}

type objcIndex struct {
	Classes   map[string]*objcClass
	Selectors map[string]bool
	Ivars     map[string]bool
}

func newObjCIndex() *objcIndex {
	return &objcIndex{
		Classes:   map[string]*objcClass{},
		Selectors: map[string]bool{},
		Ivars:     map[string]bool{},
	}
}

type objcLookup int

const (
	objcFound objcLookup = iota
	objcMissing
	objcInheritedExternally
)

func (index *objcIndex) lookupMethod(className, selector string) (objcLookup, string) {
	visited := map[string]bool{}
	current := index.Classes[className]
	for current != nil && !visited[current.Name] {
		visited[current.Name] = true
		if current.Methods[selector] {
			return objcFound, current.Name
		}
		if current.SuperExternal {
			return objcInheritedExternally, current.Super
		}
		current = index.Classes[current.Super]
	}
	return objcMissing, ""
}

type machoImage struct {
	file          *macho.File
	data          []byte
	base          uint64
	pointerFormat uint16
	imports       []string
}

func addMachOToIndex(index *objcIndex, data []byte) error {
	file, err := openMachOSlice(data)
	if err != nil {
		return err
	}
	image := &machoImage{file: file, data: data}
	if text := file.Segment("__TEXT"); text != nil {
		image.base = text.Addr
	}
	if err := image.readChainedFixups(); err != nil {
		return err
	}
	return image.collect(index)
}

func openMachOSlice(data []byte) (*macho.File, error) {
	if fat, err := macho.NewFatFile(bytes.NewReader(data)); err == nil {
		for _, arch := range fat.Arches {
			if arch.Cpu == macho.CpuArm64 {
				return arch.File, nil
			}
		}
		if len(fat.Arches) > 0 {
			return fat.Arches[0].File, nil
		}
		return nil, errors.New("empty universal binary")
	}
	return macho.NewFile(bytes.NewReader(data))
}

func isMachO(data []byte) bool {
	if len(data) < 4 {
		return false
	}
	magic := binary.BigEndian.Uint32(data)
	switch magic {
	case 0xCFFAEDFE, 0xCEFAEDFE, 0xCAFEBABE, 0xFEEDFACF:
		return true
	}
	return false
}

func (image *machoImage) fileOffset(address uint64) (uint64, bool) {
	for _, segment := range image.segments() {
		if address >= segment.Addr && address < segment.Addr+segment.Filesz {
			return segment.Offset + address - segment.Addr, true
		}
	}
	return 0, false
}

func (image *machoImage) segments() []*macho.Segment {
	var segments []*macho.Segment
	for _, load := range image.file.Loads {
		if segment, ok := load.(*macho.Segment); ok {
			segments = append(segments, segment)
		}
	}
	return segments
}

func (image *machoImage) readChainedFixups() error {
	for _, load := range image.file.Loads {
		raw := load.Raw()
		if len(raw) < 16 || image.file.ByteOrder.Uint32(raw) != loadCommandChainedFixups {
			continue
		}
		offset := uint64(image.file.ByteOrder.Uint32(raw[8:]))
		size := uint64(image.file.ByteOrder.Uint32(raw[12:]))
		if offset+size > uint64(len(image.data)) {
			return errors.New("chained fixups out of range")
		}
		return image.parseChainedFixups(image.data[offset : offset+size])
	}
	return nil
}

func (image *machoImage) parseChainedFixups(blob []byte) error {
	if len(blob) < 28 {
		return errors.New("chained fixups header is truncated")
	}
	order := binary.LittleEndian
	startsOffset := uint64(order.Uint32(blob[4:]))
	importsOffset := uint64(order.Uint32(blob[8:]))
	symbolsOffset := uint64(order.Uint32(blob[12:]))
	importsCount := uint64(order.Uint32(blob[16:]))
	importsFormat := order.Uint32(blob[20:])

	symbol := func(nameOffset uint64) string {
		start := symbolsOffset + nameOffset
		if start >= uint64(len(blob)) {
			return ""
		}
		end := bytes.IndexByte(blob[start:], 0)
		if end < 0 {
			return ""
		}
		return string(blob[start : start+uint64(end)])
	}

	image.imports = make([]string, importsCount)
	for index := uint64(0); index < importsCount; index++ {
		switch importsFormat {
		case 1:
			entry := order.Uint32(blob[importsOffset+4*index:])
			image.imports[index] = symbol(uint64(entry >> 9))
		case 2:
			entry := order.Uint32(blob[importsOffset+8*index:])
			image.imports[index] = symbol(uint64(entry >> 9))
		case 3:
			entry := order.Uint64(blob[importsOffset+16*index:])
			image.imports[index] = symbol(entry >> 32)
		default:
			return fmt.Errorf("unsupported chained import format %d", importsFormat)
		}
	}

	if startsOffset+4 > uint64(len(blob)) {
		return nil
	}
	segmentCount := uint64(order.Uint32(blob[startsOffset:]))
	for index := uint64(0); index < segmentCount; index++ {
		infoOffset := uint64(order.Uint32(blob[startsOffset+4+4*index:]))
		if infoOffset == 0 {
			continue
		}
		start := startsOffset + infoOffset
		if start+8 > uint64(len(blob)) {
			continue
		}
		image.pointerFormat = order.Uint16(blob[start+6:])
		break
	}
	return nil
}

type machoPointer struct {
	address  uint64
	external string
}

func (image *machoImage) readPointer(address uint64) (machoPointer, bool) {
	offset, ok := image.fileOffset(address)
	if !ok || offset+8 > uint64(len(image.data)) {
		return machoPointer{}, false
	}
	raw := binary.LittleEndian.Uint64(image.data[offset:])
	if raw == 0 {
		return machoPointer{}, true
	}
	if image.imports == nil {
		return machoPointer{address: raw}, true
	}

	bindName := func(ordinal uint64) machoPointer {
		if ordinal < uint64(len(image.imports)) {
			return machoPointer{external: image.imports[ordinal]}
		}
		return machoPointer{external: "?"}
	}

	switch image.pointerFormat {
	case 1, 9, 12:
		isAuth := raw>>63 == 1
		isBind := (raw>>62)&1 == 1
		if isBind {
			mask := uint64(0xFFFF)
			if image.pointerFormat == 12 {
				mask = 0xFFFFFF
			}
			return bindName(raw & mask), true
		}
		if isAuth {
			return machoPointer{address: image.base + raw&0xFFFFFFFF}, true
		}
		target := raw & 0x7FFFFFFFFFF
		if image.pointerFormat != 1 {
			target += image.base
		}
		return machoPointer{address: target}, true
	default:
		if raw>>63 == 1 {
			return bindName(raw & 0xFFFFFF), true
		}
		target := raw & 0xFFFFFFFFF
		high := (raw >> 36) & 0xFF
		if image.pointerFormat == 6 {
			target += image.base
		}
		return machoPointer{address: target | high<<56}, true
	}
}

func (image *machoImage) readCString(address uint64) string {
	offset, ok := image.fileOffset(address)
	if !ok {
		return ""
	}
	end := bytes.IndexByte(image.data[offset:], 0)
	if end < 0 {
		return ""
	}
	return string(image.data[offset : offset+uint64(end)])
}

func (image *machoImage) readUint32(address uint64) (uint32, bool) {
	offset, ok := image.fileOffset(address)
	if !ok || offset+4 > uint64(len(image.data)) {
		return 0, false
	}
	return binary.LittleEndian.Uint32(image.data[offset:]), true
}

func (image *machoImage) pointerList(name string) []machoPointer {
	section := image.file.Section(name)
	if section == nil {
		return nil
	}
	var pointers []machoPointer
	for address := section.Addr; address+8 <= section.Addr+section.Size; address += 8 {
		if pointer, ok := image.readPointer(address); ok {
			pointers = append(pointers, pointer)
		}
	}
	return pointers
}

func (image *machoImage) collect(index *objcIndex) error {
	for _, pointer := range image.pointerList("__objc_selrefs") {
		if pointer.address != 0 {
			if name := image.readCString(pointer.address); name != "" {
				index.Selectors[name] = true
			}
		}
	}

	for _, pointer := range image.pointerList("__objc_classlist") {
		if pointer.address == 0 {
			continue
		}
		class := image.readClass(pointer.address, index)
		if class == nil {
			continue
		}
		if existing := index.Classes[class.Name]; existing != nil {
			for method := range class.Methods {
				existing.Methods[method] = true
			}
			continue
		}
		index.Classes[class.Name] = class
	}

	for _, pointer := range image.pointerList("__objc_catlist") {
		if pointer.address != 0 {
			image.readCategory(pointer.address, index)
		}
	}
	return nil
}

func externalClassName(symbol string) string {
	for _, prefix := range []string{"_OBJC_CLASS_$_", "_OBJC_METACLASS_$_"} {
		if strings.HasPrefix(symbol, prefix) {
			return demangleObjCClassName(strings.TrimPrefix(symbol, prefix))
		}
	}
	return symbol
}

func (image *machoImage) readClass(address uint64, index *objcIndex) *objcClass {
	data, ok := image.readPointer(address + 32)
	if !ok || data.address == 0 {
		return nil
	}
	readOnly := data.address &^ 7
	namePointer, ok := image.readPointer(readOnly + 24)
	if !ok || namePointer.address == 0 {
		return nil
	}
	class := &objcClass{
		Name:    demangleObjCClassName(image.readCString(namePointer.address)),
		Methods: map[string]bool{},
		Ivars:   map[string]bool{},
	}
	if class.Name == "" {
		return nil
	}

	if super, ok := image.readPointer(address + 8); ok {
		switch {
		case super.external != "":
			class.Super = externalClassName(super.external)
			class.SuperExternal = true
		case super.address != 0:
			class.Super = image.classNameAt(super.address)
		}
	}

	image.readMethods(readOnly+32, class.Methods, index)
	image.readIvars(readOnly+48, class.Ivars, index)

	if meta, ok := image.readPointer(address); ok && meta.address != 0 {
		if metaData, ok := image.readPointer(meta.address + 32); ok && metaData.address != 0 {
			image.readMethods((metaData.address&^7)+32, class.Methods, index)
		}
	}
	return class
}

func (image *machoImage) classNameAt(address uint64) string {
	data, ok := image.readPointer(address + 32)
	if !ok || data.address == 0 {
		return ""
	}
	namePointer, ok := image.readPointer((data.address &^ 7) + 24)
	if !ok || namePointer.address == 0 {
		return ""
	}
	return demangleObjCClassName(image.readCString(namePointer.address))
}

func (image *machoImage) readCategory(address uint64, index *objcIndex) {
	classPointer, ok := image.readPointer(address + 8)
	if !ok {
		return
	}
	var className string
	switch {
	case classPointer.external != "":
		className = externalClassName(classPointer.external)
	case classPointer.address != 0:
		className = image.classNameAt(classPointer.address)
	}
	if className == "" {
		return
	}
	class := index.Classes[className]
	if class == nil {
		class = &objcClass{Name: className, Methods: map[string]bool{}, Ivars: map[string]bool{}, SuperExternal: true}
		if classPointer.external != "" {
			index.Classes["category:"+className] = class
		} else {
			index.Classes[className] = class
		}
	}
	image.readMethods(address+16, class.Methods, index)
	image.readMethods(address+24, class.Methods, index)
}

func (image *machoImage) readMethods(field uint64, methods map[string]bool, index *objcIndex) {
	list, ok := image.readPointer(field)
	if !ok || list.address == 0 {
		return
	}
	header, ok := image.readUint32(list.address)
	if !ok {
		return
	}
	count, ok := image.readUint32(list.address + 4)
	if !ok || count > 1<<16 {
		return
	}
	relative := header&0x80000000 != 0
	entrySize := uint64(header & 0xFFFC)
	if entrySize == 0 {
		return
	}
	for entry := uint64(0); entry < uint64(count); entry++ {
		address := list.address + 8 + entry*entrySize
		var name string
		if relative {
			offset, ok := image.readUint32(address)
			if !ok {
				continue
			}
			target := uint64(int64(address) + int64(int32(offset)))
			if header&0x40000000 != 0 {
				name = image.readCString(target)
			} else if selector, ok := image.readPointer(target); ok && selector.address != 0 {
				name = image.readCString(selector.address)
			}
		} else if pointer, ok := image.readPointer(address); ok && pointer.address != 0 {
			name = image.readCString(pointer.address)
		}
		if name != "" {
			methods[name] = true
			index.Selectors[name] = true
		}
	}
}

func (image *machoImage) readIvars(field uint64, ivars map[string]bool, index *objcIndex) {
	list, ok := image.readPointer(field)
	if !ok || list.address == 0 {
		return
	}
	entrySize, ok := image.readUint32(list.address)
	if !ok || entrySize < 24 {
		return
	}
	count, ok := image.readUint32(list.address + 4)
	if !ok || count > 1<<16 {
		return
	}
	for entry := uint64(0); entry < uint64(count); entry++ {
		address := list.address + 8 + entry*uint64(entrySize)
		if pointer, ok := image.readPointer(address + 8); ok && pointer.address != 0 {
			if name := image.readCString(pointer.address); name != "" {
				ivars[name] = true
				index.Ivars[name] = true
			}
		}
	}
}

func demangleObjCClassName(name string) string {
	if !strings.HasPrefix(name, "_TtC") && !strings.HasPrefix(name, "_TtGC") {
		return name
	}
	rest := strings.TrimPrefix(strings.TrimPrefix(name, "_TtGC"), "_TtC")
	if strings.HasPrefix(rest, "s") && len(rest) > 1 && rest[1] >= '0' && rest[1] <= '9' {
		rest = "5Swift" + rest[1:]
	}
	var parts []string
	for len(rest) > 0 {
		if rest[0] == 'C' || rest[0] == 'V' || rest[0] == 'O' {
			rest = rest[1:]
			continue
		}
		digits := 0
		for digits < len(rest) && rest[digits] >= '0' && rest[digits] <= '9' {
			digits++
		}
		if digits == 0 {
			break
		}
		length, err := strconv.Atoi(rest[:digits])
		if err != nil || digits+length > len(rest) {
			return name
		}
		parts = append(parts, rest[digits:digits+length])
		rest = rest[digits+length:]
	}
	if len(parts) < 2 {
		return name
	}
	return strings.Join(parts, ".")
}
