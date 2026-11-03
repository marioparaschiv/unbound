package app.unbound.android

import org.json.JSONObject
import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.util.concurrent.ExecutionException
import java.util.concurrent.FutureTask

object Attestation {
    private const val POINT_BYTES = 65
    private const val COORDINATE_BYTES = 32

    data class Result(val verified: Boolean, val detail: String, val warningTitle: String, val warningMessage: String)

    private const val THREAD_NAME = "unbound-attestation"
    private const val NANOS_PER_MILLI = 1_000_000L

    @Volatile private var pending: FutureTask<Result>? = null

    fun start(evaluation: () -> Map<String, String> = { fields(NativeBridge.nativeAttestation()) }) {
        synchronized(this) {
            if (pending != null) return
            val task = FutureTask { timed(evaluation) }
            pending = task
            Thread(task, THREAD_NAME).apply { isDaemon = true }.start()
        }
    }

    fun current(): Result {
        start()
        val task = pending!!
        if (task.isDone) return resultOf(task)
        val waitStarted = System.nanoTime()
        val result = resultOf(task)
        Logger.info(LogCategory.DEFAULT, "Waited ${elapsedMillis(waitStarted)} ms for the attestation result")
        return result
    }

    private fun timed(evaluation: () -> Map<String, String>): Result {
        val started = System.nanoTime()
        val result = evaluate(evaluation())
        Logger.info(LogCategory.DEFAULT, "Attestation evaluated off the main thread in ${elapsedMillis(started)} ms")
        return result
    }

    private fun resultOf(task: FutureTask<Result>): Result = try {
        task.get()
    } catch (failure: ExecutionException) {
        throw failure.cause ?: failure
    }

    private fun elapsedMillis(started: Long): Long = (System.nanoTime() - started) / NANOS_PER_MILLI

    internal fun reset() {
        synchronized(this) { pending = null }
    }

    private fun fields(json: String): Map<String, String> {
        val parsed = JSONObject(json)
        return parsed.keys().asSequence().associateWith { parsed.optString(it) }
    }

    fun evaluate(evaluation: Map<String, String>): Result {
        val title = evaluation["warningTitle"].orEmpty()
        val message = evaluation["warningMessage"].orEmpty()
        val failure = evaluation["failure"].orEmpty()
        if (failure.isNotEmpty()) return Result(false, failure, title, message)

        val verified = runCatching {
            verifySignature(
                hexBytes(evaluation.getValue("digest")),
                hexBytes(evaluation.getValue("signature")),
                hexBytes(evaluation.getValue("publicKey")),
            )
        }.getOrDefault(false)
        val detail = if (verified) "commit ${evaluation["commitHash"].orEmpty()}" else "P-256 signature mismatch"

        return Result(verified, detail, title, message)
    }

    fun verifySignature(digest: ByteArray, signature: ByteArray, point: ByteArray): Boolean {
        if (point.size != POINT_BYTES || point[0] != 0x04.toByte()) return false

        val parameters = AlgorithmParameters.getInstance("EC").apply { init(ECGenParameterSpec("secp256r1")) }
            .getParameterSpec(ECParameterSpec::class.java)
        val coordinates = ECPoint(
            BigInteger(1, point.copyOfRange(1, 1 + COORDINATE_BYTES)),
            BigInteger(1, point.copyOfRange(1 + COORDINATE_BYTES, POINT_BYTES)),
        )
        val key = KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(coordinates, parameters))

        return Signature.getInstance("NONEwithECDSA").run {
            initVerify(key)
            update(digest)
            verify(signature)
        }
    }

    private fun hexBytes(text: String): ByteArray =
        ByteArray(text.length / 2) { text.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
}
