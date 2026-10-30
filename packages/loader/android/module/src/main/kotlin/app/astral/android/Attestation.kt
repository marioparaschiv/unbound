package app.astral.android

import org.json.JSONObject
import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec

object Attestation {
    private const val POINT_BYTES = 65
    private const val COORDINATE_BYTES = 32

    data class Result(val verified: Boolean, val detail: String, val warningTitle: String, val warningMessage: String)

    @Volatile private var cached: Result? = null

    fun current(): Result = cached ?: evaluate(fields(NativeBridge.nativeAttestation())).also { cached = it }

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
