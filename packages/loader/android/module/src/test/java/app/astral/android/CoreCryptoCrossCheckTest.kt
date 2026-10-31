package app.astral.android

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

class CoreCryptoCrossCheckTest {
    private val vectors: List<List<String>> by lazy {
        File(System.getProperty("astral.coreCryptoVectors"))
            .readLines()
            .filter { it.isNotBlank() }
            .map { it.split(" ") }
    }

    private fun bytes(hex: String): ByteArray = if (hex == "-") ByteArray(0) else hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()

    private fun hex(value: ByteArray): String = value.joinToString("") { "%02x".format(it) }

    private fun of(kind: String): List<List<String>> = vectors.filter { it.first() == kind }.also { assertTrue(it.isNotEmpty()) }

    private fun aes(mode: Int, key: ByteArray, iv: ByteArray, input: ByteArray): ByteArray =
        Cipher.getInstance("AES/CBC/PKCS5Padding").run {
            init(mode, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
            doFinal(input)
        }

    private fun hmac(key: ByteArray, message: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(message)
        }

    @Test
    fun javaxCryptoProducesTheCoreCiphertexts() {
        for ((_, key, iv, plaintext, ciphertext) in of("aes256cbc")) {
            assertEquals(ciphertext, hex(aes(Cipher.ENCRYPT_MODE, bytes(key), bytes(iv), bytes(plaintext))))
            assertArrayEquals(bytes(plaintext), aes(Cipher.DECRYPT_MODE, bytes(key), bytes(iv), bytes(ciphertext)))
        }
    }

    @Test
    fun javaxCryptoProducesTheCoreMACs() {
        for ((_, key, message, mac) in of("hmacsha256").filter { it[1] != "-" }) {
            assertEquals(mac, hex(hmac(bytes(key), bytes(message))))
        }
    }

    @Test
    fun javaSecurityProducesTheCoreDigests() {
        for ((_, message, digest) in of("sha256")) {
            assertEquals(digest, hex(MessageDigest.getInstance("SHA-256").digest(bytes(message))))
        }
    }

    @Test
    fun javaxCryptoOpensBrowserLoginCallbacks() {
        for (vector in of("browserlogin")) {
            val secret = bytes(vector[1])
            val state = vector[2]
            val iv = bytes(vector[3])
            val ciphertext = bytes(vector[5])
            val authenticated = state.toByteArray() + iv + ciphertext
            assertEquals(vector[6], hex(hmac(secret.copyOfRange(32, 64), authenticated)))
            val token = aes(Cipher.DECRYPT_MODE, secret.copyOfRange(0, 32), iv, ciphertext)
            assertEquals(vector[4], String(token))
        }
    }
}
