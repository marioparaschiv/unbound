package main

import (
	"encoding/binary"
	"errors"
	"fmt"
	"unicode/utf16"
)

const (
	resourceTableChunk     = 0x0002
	resourceStringPool     = 0x0001
	resourcePackageChunk   = 0x0200
	resourceTypeChunk      = 0x0201
	resourceSparseFlag     = 0x01
	resourceOffset16Flag   = 0x02
	resourceCompactFlag    = 0x0008
	resourcePackageMinSize = 288
	resourceNoEntry32      = 0xFFFFFFFF
	resourceNoEntry16      = 0xFFFF
)

const discordPackageName = "com.discord"

type androidResources struct {
	names map[string]map[string]bool
}

func (resources *androidResources) has(packageName, kind, name string) bool {
	return resources.names[packageName][kind+"/"+name]
}

type resourceChunk struct {
	kind       uint16
	offset     int
	headerSize int
	data       []byte
}

func resourceChunks(data []byte, offset int) ([]resourceChunk, error) {
	var chunks []resourceChunk
	for offset+8 <= len(data) {
		headerSize := int(binary.LittleEndian.Uint16(data[offset+2:]))
		size := int(binary.LittleEndian.Uint32(data[offset+4:]))
		if size < 8 || headerSize < 8 || headerSize > size || offset+size > len(data) {
			return nil, fmt.Errorf("malformed resource chunk at %d", offset)
		}
		chunks = append(chunks, resourceChunk{kind: binary.LittleEndian.Uint16(data[offset:]), offset: offset, headerSize: headerSize, data: data[offset : offset+size]})
		offset += size
	}
	return chunks, nil
}

func parseResourceTable(data []byte) (*androidResources, error) {
	if len(data) < 12 || binary.LittleEndian.Uint16(data) != resourceTableChunk {
		return nil, errors.New("resources.arsc is not a resource table")
	}
	chunks, err := resourceChunks(data, int(binary.LittleEndian.Uint16(data[2:])))
	if err != nil {
		return nil, err
	}
	resources := &androidResources{names: map[string]map[string]bool{}}
	for _, chunk := range chunks {
		if chunk.kind != resourcePackageChunk {
			continue
		}
		name, names, err := parseResourcePackage(chunk)
		if err != nil {
			return nil, fmt.Errorf("resource package: %w", err)
		}
		resources.names[name] = names
	}
	return resources, nil
}

func parseResourcePackage(chunk resourceChunk) (string, map[string]bool, error) {
	if chunk.headerSize < resourcePackageMinSize-4 || len(chunk.data) < chunk.headerSize {
		return "", nil, errors.New("truncated package header")
	}
	name := resourcePackageName(chunk.data[12:268])
	children, err := resourceChunks(chunk.data, chunk.headerSize)
	if err != nil {
		return "", nil, err
	}
	typeOffset := int(binary.LittleEndian.Uint32(chunk.data[268:]))
	keyOffset := int(binary.LittleEndian.Uint32(chunk.data[276:]))
	var typeNames, keyNames []string
	for _, child := range children {
		if child.kind != resourceStringPool {
			continue
		}
		if child.offset != typeOffset && child.offset != keyOffset {
			continue
		}
		pool, err := parseBinaryXMLStrings(child.data, child.headerSize)
		if err != nil {
			return "", nil, err
		}
		if child.offset == typeOffset {
			typeNames = pool
		} else {
			keyNames = pool
		}
	}
	names := map[string]bool{}
	for _, child := range children {
		if child.kind != resourceTypeChunk {
			continue
		}
		kind, keys, err := resourceTypeKeys(child, typeNames)
		if err != nil {
			return "", nil, err
		}
		for _, key := range keys {
			if int(key) < len(keyNames) {
				names[kind+"/"+keyNames[key]] = true
			}
		}
	}
	return name, names, nil
}

func resourcePackageName(raw []byte) string {
	units := make([]uint16, 0, len(raw)/2)
	for position := 0; position+2 <= len(raw); position += 2 {
		unit := binary.LittleEndian.Uint16(raw[position:])
		if unit == 0 {
			break
		}
		units = append(units, unit)
	}
	return string(utf16.Decode(units))
}

func resourceTypeKeys(chunk resourceChunk, typeNames []string) (string, []uint32, error) {
	data := chunk.data
	if chunk.headerSize < 20 {
		return "", nil, errors.New("truncated type header")
	}
	id := int(data[8])
	if id < 1 || id > len(typeNames) {
		return "", nil, fmt.Errorf("type id %d has no name", id)
	}
	flags := data[9]
	count := int(binary.LittleEndian.Uint32(data[12:]))
	entries := int(binary.LittleEndian.Uint32(data[16:]))
	width := 4
	if flags&resourceOffset16Flag != 0 {
		width = 2
	}
	if chunk.headerSize+count*width > len(data) {
		return "", nil, errors.New("type entry offsets overflow their chunk")
	}
	var keys []uint32
	for index := 0; index < count; index++ {
		slot := chunk.headerSize + index*width
		offset, present := 0, true
		switch {
		case flags&resourceSparseFlag != 0:
			offset = int(binary.LittleEndian.Uint16(data[slot+2:])) * 4
		case width == 2:
			raw := binary.LittleEndian.Uint16(data[slot:])
			offset, present = int(raw)*4, raw != resourceNoEntry16
		default:
			raw := binary.LittleEndian.Uint32(data[slot:])
			offset, present = int(raw), raw != resourceNoEntry32
		}
		if !present {
			continue
		}
		entry := entries + offset
		if entry+8 > len(data) {
			return "", nil, errors.New("type entry overflows its chunk")
		}
		if binary.LittleEndian.Uint16(data[entry+2:])&resourceCompactFlag != 0 {
			keys = append(keys, uint32(binary.LittleEndian.Uint16(data[entry:])))
		} else {
			keys = append(keys, binary.LittleEndian.Uint32(data[entry+4:]))
		}
	}
	return typeNames[id-1], keys, nil
}
