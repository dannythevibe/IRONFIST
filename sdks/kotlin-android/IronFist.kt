package dev.ironfist.sdk

import android.content.Context
import android.media.MediaDrm
import android.os.Build
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.util.UUID

class IronFistAndroid(private val context: Context) {

    fun collectTraits(): Map<String, Any> {
        val traits = mutableMapOf<String, Any>(
            "os_platform" to "android",
            "os_version" to Build.VERSION.RELEASE,
            "cpu_cores" to Runtime.getRuntime().availableProcessors(),
            "memory_gb" to 8,
            "encrypted_sp_id" to getOrCreateEncryptedStorageId()
        )

        getWidevineDrmId()?.let { drmId ->
            traits["widevine_drm_id"] = drmId
        }

        return traits
    }

    private fun getWidevineDrmId(): String? {
        return try {
            val widevineUuid = UUID(-0x121074568629b532L, -0x5c37d823267d3772L)
            val mediaDrm = MediaDrm(widevineUuid)
            val widevineId = mediaDrm.getPropertyByteArray(MediaDrm.PROPERTY_DEVICE_UNIQUE_ID)
            mediaDrm.close()
            widevineId.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }

    private fun getOrCreateEncryptedStorageId(): String {
        return try {
            const val PREF_NAME = "ironfist_secure_prefs"
            const val KEY_DEVICE_ID = "device_id"
            val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
            val sharedPreferences = EncryptedSharedPreferences.create(
                PREF_NAME,
                masterKeyAlias,
                context,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )

            var id = sharedPreferences.getString(KEY_DEVICE_ID, null)
            if (id == null) {
                id = UUID.randomUUID().toString()
                sharedPreferences.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            id
        } catch (e: Exception) {
            UUID.randomUUID().toString()
        }
    }
}
