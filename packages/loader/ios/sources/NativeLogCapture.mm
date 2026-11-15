#import "NativeLogCapture.h"

#import <Foundation/Foundation.h>
#include <cerrno>
#include <cstdio>
#include <fcntl.h>
#include <poll.h>
#include <pthread.h>
#include <unistd.h>

#include "LoaderLogFile.h"
#include "LoaderNativeLogLines.h"

// Nothing on the reader thread may write to stderr or stdout: the bytes would come back through
// the pipe it reads, and a full pipe would block the thread that has to drain it.

namespace {
constexpr int kCapturedStreamCount = 2;
constexpr int kIdleFlushMs         = 1000;
constexpr size_t kReadSize         = 4096;

struct CapturedStream {
    int target   = -1;
    int original = -1;
    int read     = -1;
    int write    = -1;
    loader::NativeLogLineSplitter lines;
};

CapturedStream gStreams[kCapturedStreamCount];

// Writes all of `bytes` to `fd`, so Xcode and the console see what they did before. A failure is
// dropped: the original stream may be closed, and nothing here may log.
void forward(int fd, const char *bytes, size_t length)
{
    while (length > 0)
    {
        ssize_t written = write(fd, bytes, length);
        if (written < 0)
        {
            if (errno == EINTR)
            {
                continue;
            }

            return;
        }

        bytes += written;
        length -= static_cast<size_t>(written);
    }
}

void record(std::string text)
{
    std::optional<loader::NativeLogLine> line = loader::classifyNativeLogLine(text);
    if (!line)
    {
        return;
    }

    UnboundAppendNativeLog(static_cast<int>(line->source), static_cast<int>(line->level),
                           line->scope.c_str(), line->message.c_str());
}

void closeStream(CapturedStream &stream)
{
    for (int *fd : {&stream.original, &stream.read, &stream.write})
    {
        if (*fd >= 0)
        {
            close(*fd);
            *fd = -1;
        }
    }
}

// A pipe for `target` and a copy of where it points now; `target` itself changes later.
bool prepareStream(int target, CapturedStream &stream)
{
    int ends[2];
    if (pipe(ends) != 0)
    {
        return false;
    }

    stream.target   = target;
    stream.read     = ends[0];
    stream.write    = ends[1];
    stream.original = dup(target);
    if (stream.original < 0)
    {
        closeStream(stream);
        return false;
    }

    for (int fd : {stream.original, stream.read, stream.write})
    {
        fcntl(fd, F_SETFD, FD_CLOEXEC);
    }

    return true;
}

void *readStreams(void *)
{
    pthread_setname_np("app.unbound.native-log");
    pollfd descriptors[kCapturedStreamCount];
    for (int index = 0; index < kCapturedStreamCount; index++)
    {
        descriptors[index] = {gStreams[index].read, POLLIN, 0};
    }

    char buffer[kReadSize];
    int open = kCapturedStreamCount;
    while (open > 0)
    {
        bool pending = false;
        for (CapturedStream &stream : gStreams)
        {
            pending = pending || stream.lines.hasPending();
        }

        // Waits without a timeout while no partial line is held, so an idle process never wakes.
        int ready = poll(descriptors, kCapturedStreamCount, pending ? kIdleFlushMs : -1);
        if (ready < 0 && errno != EINTR)
        {
            return nullptr;
        }

        for (int index = 0; index < kCapturedStreamCount; index++)
        {
            CapturedStream &stream = gStreams[index];
            if (ready == 0 && stream.lines.hasPending())
            {
                stream.lines.flush(record);
            }

            if (ready <= 0 || descriptors[index].fd < 0 || descriptors[index].revents == 0)
            {
                continue;
            }

            ssize_t count = read(stream.read, buffer, sizeof(buffer));
            if (count > 0)
            {
                forward(stream.original, buffer, static_cast<size_t>(count));
                stream.lines.feed(std::string_view(buffer, static_cast<size_t>(count)), record);
            }
            else if (count == 0 || (errno != EINTR && errno != EAGAIN))
            {
                // Only the read side: the write end belongs to the thread that redirected it.
                stream.lines.flush(record);
                close(stream.read);
                close(stream.original);
                descriptors[index].fd = -1;
                open--;
            }
        }
    }

    return nullptr;
}

bool startReader()
{
    pthread_attr_t attributes;
    pthread_t thread;
    pthread_attr_init(&attributes);
    pthread_attr_setdetachstate(&attributes, PTHREAD_CREATE_DETACHED);
    pthread_attr_set_qos_class_np(&attributes, QOS_CLASS_UTILITY, 0);
    int failed = pthread_create(&thread, &attributes, readStreams, nullptr);
    pthread_attr_destroy(&attributes);
    return failed == 0;
}

void startCapture()
{
    for (int index = 0; index < kCapturedStreamCount; index++)
    {
        if (!prepareStream(index == 0 ? STDERR_FILENO : STDOUT_FILENO, gStreams[index]))
        {
            for (CapturedStream &stream : gStreams)
            {
                closeStream(stream);
            }

            return;
        }
    }

    // The reader runs before any write lands in a pipe, so a write can never block on a pipe that
    // nothing drains.
    if (!startReader())
    {
        for (CapturedStream &stream : gStreams)
        {
            closeStream(stream);
        }

        return;
    }

    // A pipe would make stdio fully buffer stdout; keep printf lines arriving as they are written.
    fflush(stdout);
    setvbuf(stdout, nullptr, _IOLBF, 0);
    for (CapturedStream &stream : gStreams)
    {
        // A failed redirect leaves the stream as it was; its pipe then reads end-of-file.
        dup2(stream.write, stream.target);
        close(stream.write);
        stream.write = -1;
    }
}
}

void UnboundStartNativeLogCapture()
{
    static dispatch_once_t once;
    dispatch_once(&once, ^{ startCapture(); });
}
