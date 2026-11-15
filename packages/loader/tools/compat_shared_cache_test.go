package main

import (
	"encoding/binary"
	"testing"
)

type fakeObjCMemory struct {
	words        map[uint64]uint32
	pointers     map[uint64]uint64
	strings      map[uint64]string
	selectorBase uint64
}

func (memory *fakeObjCMemory) readPointer(address uint64) (machoPointer, bool) {
	target, ok := memory.pointers[address]
	return machoPointer{address: target}, ok
}

func (memory *fakeObjCMemory) readCString(address uint64) string {
	return memory.strings[address]
}

func (memory *fakeObjCMemory) readUint32(address uint64) (uint32, bool) {
	value, ok := memory.words[address]
	return value, ok
}

func (memory *fakeObjCMemory) pointerList(string) []machoPointer {
	return nil
}

func (memory *fakeObjCMemory) relativeSelectorBase() uint64 {
	return memory.selectorBase
}

func (memory *fakeObjCMemory) putUint64(address, value uint64) {
	var raw [8]byte
	binary.LittleEndian.PutUint64(raw[:], value)
	memory.words[address] = binary.LittleEndian.Uint32(raw[:4])
	memory.words[address+4] = binary.LittleEndian.Uint32(raw[4:])
}

func TestReadMethodsFollowsListsOfListsWithSelectorBase(t *testing.T) {
	memory := &fakeObjCMemory{
		words:        map[uint64]uint32{},
		pointers:     map[uint64]uint64{0x100: 0x2001},
		strings:      map[uint64]string{0x9000: "layoutSubviews", 0x9010: "_imageWithCGSVGDocument:scale:orientation:"},
		selectorBase: 0x9000,
	}
	memory.words[0x2000] = 8
	memory.words[0x2004] = 1
	memory.putUint64(0x2008, uint64(0x3000-0x2008)<<16)
	memory.words[0x3000] = 0xC000000C
	memory.words[0x3004] = 2
	memory.words[0x3008] = 0
	memory.words[0x3014] = 0x10

	methods := map[string]bool{}
	index := newObjCIndex()
	readMethods(memory, 0x100, methods, index)

	for _, want := range []string{"layoutSubviews", "_imageWithCGSVGDocument:scale:orientation:"} {
		if !methods[want] || !index.Selectors[want] {
			t.Fatalf("methods %v miss %s", methods, want)
		}
	}
}

func TestDecodePointerResolvesCacheOffsets(t *testing.T) {
	cache := &sharedCache{base: 0x180000000, mappings: []sharedCacheMapping{{address: 0x180000000, size: 0x10000000}}}
	if got := cache.decodePointer(0x180001000); got != 0x180001000 {
		t.Fatalf("absolute pointer decoded to %#x", got)
	}

	if got := cache.decodePointer(1<<63 | 0x2000); got != 0x180002000 {
		t.Fatalf("authenticated pointer decoded to %#x", got)
	}

	if got := cache.decodePointer(0); got != 0 {
		t.Fatalf("null pointer decoded to %#x", got)
	}
}
