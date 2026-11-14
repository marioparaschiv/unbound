package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	sharedCacheBlockSize       = 1 << 16
	sharedCacheMappingOffset   = 0x10
	sharedCacheImagesOld       = 0x18
	sharedCacheImagesNew       = 0x1c0
	sharedCacheObjCOptsOffset  = 0x1d0
	sharedCacheMappingSize     = 32
	sharedCacheImageSize       = 32
	objcOptsSelectorBaseOffset = 48
	loadCommandSegment64       = 0x19
	segmentCommandHeaderSize   = 72
	sectionHeaderSize          = 80
	machHeader64Size           = 32
	relativeListListFlag       = 1
)

type sharedCacheMapping struct {
	address uint64
	size    uint64
	offset  uint64
	file    *sharedCacheFile
}

type sharedCacheFile struct {
	handle *os.File
	blocks map[uint64][]byte
}

type sharedCache struct {
	files        []*sharedCacheFile
	mappings     []sharedCacheMapping
	base         uint64
	images       []uint64
	selectorBase uint64
}

type sharedCacheImage struct {
	cache    *sharedCache
	sections map[string]sharedCacheSection
}

type sharedCacheSection struct {
	address uint64
	size    uint64
}

func openSharedCache(mainPath string) (*sharedCache, error) {
	cache := &sharedCache{}
	paths, err := sharedCacheFiles(mainPath)
	if err != nil {
		return nil, err
	}
	for index, path := range paths {
		handle, err := os.Open(path)
		if err != nil {
			cache.close()
			return nil, err
		}
		file := &sharedCacheFile{handle: handle, blocks: map[uint64][]byte{}}
		cache.files = append(cache.files, file)
		mappings, err := file.mappings()
		if err != nil {
			cache.close()
			return nil, fmt.Errorf("could not read the mappings of %s: %w", path, err)
		}
		if index == 0 && len(mappings) > 0 {
			cache.base = mappings[0].address
		}
		cache.mappings = append(cache.mappings, mappings...)
	}
	if err := cache.readImages(); err != nil {
		cache.close()
		return nil, err
	}
	cache.readSelectorBase()
	return cache, nil
}

func sharedCacheFiles(mainPath string) ([]string, error) {
	if _, err := os.Stat(mainPath); err != nil {
		return nil, err
	}
	paths := []string{mainPath}
	matches, err := filepath.Glob(mainPath + ".*")
	if err != nil {
		return nil, err
	}
	for _, match := range matches {
		suffix := strings.TrimPrefix(match, mainPath+".")
		if suffix != "map" && suffix != "atlas" && suffix != "symbols" && !strings.Contains(suffix, ".") {
			paths = append(paths, match)
		}
	}
	return paths, nil
}

func (cache *sharedCache) close() {
	for _, file := range cache.files {
		file.handle.Close()
	}
}

func (file *sharedCacheFile) read(offset, length uint64) ([]byte, bool) {
	result := make([]byte, 0, length)
	for uint64(len(result)) < length {
		position := offset + uint64(len(result))
		block, ok := file.block(position / sharedCacheBlockSize)
		if !ok {
			return nil, false
		}
		start := position % sharedCacheBlockSize
		if start >= uint64(len(block)) {
			return nil, false
		}
		end := min(uint64(len(block)), start+length-uint64(len(result)))
		result = append(result, block[start:end]...)
	}
	return result, true
}

func (file *sharedCacheFile) block(index uint64) ([]byte, bool) {
	if block, ok := file.blocks[index]; ok {
		return block, true
	}
	block := make([]byte, sharedCacheBlockSize)
	count, err := file.handle.ReadAt(block, int64(index*sharedCacheBlockSize))
	if count == 0 && err != nil {
		return nil, false
	}
	block = block[:count]
	file.blocks[index] = block
	return block, true
}

func (file *sharedCacheFile) uint32At(offset uint64) uint32 {
	data, ok := file.read(offset, 4)
	if !ok {
		return 0
	}
	return binary.LittleEndian.Uint32(data)
}

func (file *sharedCacheFile) mappings() ([]sharedCacheMapping, error) {
	magic, ok := file.read(0, 16)
	if !ok || !bytes.HasPrefix(magic, []byte("dyld_v1")) {
		return nil, errors.New("not a dyld shared cache")
	}
	offset := uint64(file.uint32At(sharedCacheMappingOffset))
	count := uint64(file.uint32At(sharedCacheMappingOffset + 4))
	if count > 64 {
		return nil, fmt.Errorf("implausible mapping count %d", count)
	}
	mappings := make([]sharedCacheMapping, 0, count)
	for index := range count {
		data, ok := file.read(offset+index*sharedCacheMappingSize, 24)
		if !ok {
			return nil, errors.New("truncated mapping table")
		}
		mappings = append(mappings, sharedCacheMapping{
			address: binary.LittleEndian.Uint64(data),
			size:    binary.LittleEndian.Uint64(data[8:]),
			offset:  binary.LittleEndian.Uint64(data[16:]),
			file:    file,
		})
	}
	return mappings, nil
}

func (cache *sharedCache) readImages() error {
	main := cache.files[0]
	offset := uint64(main.uint32At(sharedCacheImagesNew))
	count := uint64(main.uint32At(sharedCacheImagesNew + 4))
	if offset == 0 || count == 0 {
		offset = uint64(main.uint32At(sharedCacheImagesOld))
		count = uint64(main.uint32At(sharedCacheImagesOld + 4))
	}
	if count == 0 || count > 1<<16 {
		return fmt.Errorf("implausible image count %d", count)
	}
	for index := range count {
		data, ok := main.read(offset+index*sharedCacheImageSize, 8)
		if !ok {
			return errors.New("truncated image table")
		}
		cache.images = append(cache.images, binary.LittleEndian.Uint64(data))
	}
	return nil
}

func (cache *sharedCache) readSelectorBase() {
	data, ok := cache.files[0].read(sharedCacheObjCOptsOffset, 8)
	if !ok {
		return
	}
	optsOffset := binary.LittleEndian.Uint64(data)
	if optsOffset == 0 {
		return
	}
	base, ok := cache.read(cache.base+optsOffset+objcOptsSelectorBaseOffset, 8)
	if !ok {
		return
	}
	if relative := binary.LittleEndian.Uint64(base); relative != 0 {
		cache.selectorBase = cache.base + relative
	}
}

func (cache *sharedCache) mapped(address uint64) (sharedCacheMapping, bool) {
	for _, mapping := range cache.mappings {
		if address >= mapping.address && address < mapping.address+mapping.size {
			return mapping, true
		}
	}
	return sharedCacheMapping{}, false
}

func (cache *sharedCache) read(address, length uint64) ([]byte, bool) {
	mapping, ok := cache.mapped(address)
	if !ok {
		return nil, false
	}
	return mapping.file.read(mapping.offset+address-mapping.address, length)
}

func (cache *sharedCache) decodePointer(raw uint64) uint64 {
	if raw == 0 {
		return 0
	}
	if raw>>63 == 1 {
		return cache.base + raw&0xFFFFFFFF
	}
	if target := raw & 0x7FFFFFFFFFF; cache.isMapped(target) {
		return target
	}
	if target := raw & 0xFFFFFFFFF; cache.isMapped(target) {
		return target
	}
	return cache.base + raw&0x3FFFFFFFF
}

func (cache *sharedCache) isMapped(address uint64) bool {
	_, ok := cache.mapped(address)
	return ok
}

func (image *sharedCacheImage) readPointer(address uint64) (machoPointer, bool) {
	data, ok := image.cache.read(address, 8)
	if !ok {
		return machoPointer{}, false
	}
	return machoPointer{address: image.cache.decodePointer(binary.LittleEndian.Uint64(data))}, true
}

func (image *sharedCacheImage) readUint32(address uint64) (uint32, bool) {
	data, ok := image.cache.read(address, 4)
	if !ok {
		return 0, false
	}
	return binary.LittleEndian.Uint32(data), true
}

func (image *sharedCacheImage) readCString(address uint64) string {
	var name []byte
	for length := uint64(64); length <= 4096; length *= 4 {
		data, ok := image.cache.read(address, length)
		if !ok {
			data, ok = image.cache.read(address, 1)
			if !ok {
				return ""
			}
		}
		if end := bytes.IndexByte(data, 0); end >= 0 {
			return string(data[:end])
		}
		name = data
	}
	return string(name)
}

func (image *sharedCacheImage) relativeSelectorBase() uint64 {
	return image.cache.selectorBase
}

func (image *sharedCacheImage) pointerList(name string) []machoPointer {
	section, ok := image.sections[name]
	if !ok {
		return nil
	}
	var pointers []machoPointer
	for address := section.address; address+8 <= section.address+section.size; address += 8 {
		if pointer, ok := image.readPointer(address); ok {
			pointers = append(pointers, pointer)
		}
	}
	return pointers
}

func (cache *sharedCache) image(header uint64) (*sharedCacheImage, bool) {
	data, ok := cache.read(header, machHeader64Size)
	if !ok || binary.LittleEndian.Uint32(data) != 0xFEEDFACF {
		return nil, false
	}
	commandCount := binary.LittleEndian.Uint32(data[16:])
	commandsSize := uint64(binary.LittleEndian.Uint32(data[20:]))
	commands, ok := cache.read(header+machHeader64Size, commandsSize)
	if !ok {
		return nil, false
	}
	image := &sharedCacheImage{cache: cache, sections: map[string]sharedCacheSection{}}
	offset := uint64(0)
	for range commandCount {
		if offset+8 > uint64(len(commands)) {
			break
		}
		command := binary.LittleEndian.Uint32(commands[offset:])
		size := uint64(binary.LittleEndian.Uint32(commands[offset+4:]))
		if size == 0 || offset+size > uint64(len(commands)) {
			break
		}
		if command == loadCommandSegment64 {
			image.addSections(commands[offset : offset+size])
		}
		offset += size
	}
	return image, true
}

func (image *sharedCacheImage) addSections(segment []byte) {
	if len(segment) < segmentCommandHeaderSize {
		return
	}
	count := uint64(binary.LittleEndian.Uint32(segment[64:]))
	for index := range count {
		start := segmentCommandHeaderSize + index*sectionHeaderSize
		if start+sectionHeaderSize > uint64(len(segment)) {
			return
		}
		header := segment[start : start+sectionHeaderSize]
		name := string(bytes.TrimRight(header[:16], "\x00"))
		if _, exists := image.sections[name]; exists {
			continue
		}
		image.sections[name] = sharedCacheSection{
			address: binary.LittleEndian.Uint64(header[32:]),
			size:    binary.LittleEndian.Uint64(header[40:]),
		}
	}
}

func indexSharedCache(mainPath string) (*objcIndex, error) {
	cache, err := openSharedCache(mainPath)
	if err != nil {
		return nil, err
	}
	defer cache.close()
	index := newObjCIndex()
	for _, header := range cache.images {
		image, ok := cache.image(header)
		if !ok {
			continue
		}
		collectObjC(image, index)
	}
	if len(index.Classes) == 0 {
		return nil, fmt.Errorf("no Objective-C classes in the shared cache at %s", mainPath)
	}
	return index, nil
}
