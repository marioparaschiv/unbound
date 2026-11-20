package app.unbound.android

import org.junit.Assert.assertEquals
import org.junit.Test

class ScheduledRefreshTest {
    @Test
    fun stopsWaitingOnceTheWorkFinishes() {
        var clock = 0L
        var checks = 0
        ScheduledRefresh.waitWhileWorking({ ++checks < 3 }, { clock }, { clock += it })
        assertEquals(3, checks)
        assertEquals(500L, clock)
    }

    @Test
    fun stopsWaitingAtTheLimit() {
        var clock = 0L
        ScheduledRefresh.waitWhileWorking({ true }, { clock }, { clock += it })
        assertEquals(ScheduledRefresh.WAIT_LIMIT_MS, clock)
    }
}
