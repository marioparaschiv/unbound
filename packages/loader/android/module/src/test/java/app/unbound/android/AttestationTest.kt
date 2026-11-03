package app.unbound.android

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AttestationTest {
    private val point =
        "04de5f6977d305415141f4526804f7de2e5e623f3ed1cbb229b6e0604eee57731e9a70eb09acb5d331b949d" +
            "92717d9b203fa72213fedd9e7b9dd6c1259bc7dd455"
    private val digest = "40efff2e9fa4c3159f5019ef0597c4a0c6605eacd22537acac1470042c0b7382"
    private val signature =
        "30450220711f3e0a1fa74ac52a77665627d0949717d8f9af99150291fefd80ce3d2cefb4022100aea8a6b50" +
            "9c7420fda6e774e504547ebc2831fd4966cebf6c9be22570370a153"

    private fun evaluation(digest: String) = mapOf(
        "digest" to digest,
        "signature" to signature,
        "publicKey" to point,
        "commitHash" to "abc1234",
    )

    @After
    fun resetAttestation() = Attestation.reset()

    @Test
    fun startEvaluatesOffTheCallingThreadAndCurrentWaitsForTheResult() {
        val release = CountDownLatch(1)
        val evaluations = AtomicInteger()
        var evaluatedOn: Thread? = null

        Attestation.start {
            evaluatedOn = Thread.currentThread()
            evaluations.incrementAndGet()
            release.await(5, TimeUnit.SECONDS)
            evaluation(digest)
        }
        Attestation.start { error("a second start must not evaluate again") }
        release.countDown()

        val result = Attestation.current()
        assertTrue(result.verified)
        assertNotEquals(Thread.currentThread(), evaluatedOn)
        assertSame(result, Attestation.current())
        assertEquals(1, evaluations.get())
    }

    @Test
    fun aFailedEvaluationFailsClosedWhenTheResultIsNeeded() {
        Attestation.start { throw IllegalStateException("native attestation crashed") }

        try {
            Attestation.current()
            fail("the failure must reach the caller")
        } catch (expected: IllegalStateException) {
            assertEquals("native attestation crashed", expected.message)
        }
    }

    @Test
    fun aSignatureFromThePinnedKeyVerifies() {
        val result = Attestation.evaluate(evaluation(digest))

        assertTrue(result.verified)
        assertEquals("commit abc1234", result.detail)
    }

    @Test
    fun aDifferentDigestDoesNotVerify() {
        assertFalse(Attestation.evaluate(evaluation("00" + digest.drop(2))).verified)
    }

    @Test
    fun aLayoutFailureIsReported() {
        val result = Attestation.evaluate(mapOf("failure" to "ELF digest mismatch"))

        assertFalse(result.verified)
        assertEquals("ELF digest mismatch", result.detail)
    }
}
