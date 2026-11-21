#include <cassert>
#include <string>

#include "LoaderExceptionSyndrome.h"

using loader::describeExceptionSyndrome;
using loader::syndromeOfRegisters;

int main()
{
    assert(describeExceptionSyndrome(0xf2000001)
           == "BRK #0x1 (trap instruction, such as a failed Swift check)");
    assert(describeExceptionSyndrome(0x92000047)
           == "data abort on write: translation fault (unmapped address) at level 3");
    assert(describeExceptionSyndrome(0x9200000f)
           == "data abort on read: permission fault at level 3");
    assert(describeExceptionSyndrome(0x82000006)
           == "instruction abort: translation fault (unmapped address) at level 2");
    assert(describeExceptionSyndrome(0x8a000000) == "PC alignment fault");
    assert(describeExceptionSyndrome(0x0) == "unknown instruction (undefined or not allowed here)");
    assert(describeExceptionSyndrome(0x7c000000) == "exception class 0x1f");

    assert(syndromeOfRegisters("Registers x0=0x1 far=0x0 esr=0xf2000001") == 0xf2000001u);
    assert(!syndromeOfRegisters("Registers x0=0x1"));
    assert(!syndromeOfRegisters("Thread 1 esr=0x1"));
    return 0;
}
