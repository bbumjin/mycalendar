package com.aicalendar.widget.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "aicalendar_widget")
private val TOKEN_KEY = stringPreferencesKey("ics_token")
private val ALARM_CODES_KEY = stringSetPreferencesKey("alarm_codes")

object TokenStore {
    fun token(context: Context): Flow<String?> =
        context.dataStore.data.map { it[TOKEN_KEY] }

    suspend fun get(context: Context): String? = token(context).first()

    suspend fun save(context: Context, token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }

    suspend fun clear(context: Context) {
        context.dataStore.edit { it.remove(TOKEN_KEY) }
    }

    // Scheduled alarm request-codes, so we can cancel them on the next sync.
    suspend fun getAlarmCodes(context: Context): Set<Int> =
        context.dataStore.data.first()[ALARM_CODES_KEY]?.mapNotNull { it.toIntOrNull() }?.toSet() ?: emptySet()

    suspend fun saveAlarmCodes(context: Context, codes: Set<Int>) {
        context.dataStore.edit { it[ALARM_CODES_KEY] = codes.map { c -> c.toString() }.toSet() }
    }
}
