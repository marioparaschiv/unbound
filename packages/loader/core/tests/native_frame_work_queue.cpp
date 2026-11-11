#include <cassert>
#include <vector>

#include "NativeFrameWorkQueue.h"

int main()
{
    loader::native::NativeFrameWorkQueue queue;
    std::vector<int>                     observed;

    assert(queue.enqueue([&]() {
        observed.push_back(1);
    }));
    assert(!queue.enqueue([&]() {
        observed.push_back(2);
    }));
    queue.drain();
    assert((observed == std::vector<int>{1, 2}));

    assert(queue.enqueue([&]() {
        observed.push_back(3);
        assert(queue.enqueue([&]() {
            observed.push_back(4);
        }));
    }));
    queue.drain();
    assert((observed == std::vector<int>{1, 2, 3}));
    queue.drain();
    assert((observed == std::vector<int>{1, 2, 3, 4}));

    assert(queue.enqueue([&]() {
        observed.push_back(5);
    }));
    assert(!queue.enqueue([&]() {
        observed.push_back(6);
    }));
    queue.clear();
    assert(queue.enqueue([&]() {
        observed.push_back(7);
    }));
    queue.drain();
    assert((observed == std::vector<int>{1, 2, 3, 4, 7}));
}
