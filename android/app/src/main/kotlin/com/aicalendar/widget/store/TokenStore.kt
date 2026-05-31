package com.aicalendar.widget.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.time.LocalDate
import java.time.ZoneId

private val Context.dataStore by preferencesDataStore(name = "aicalendar_widget")
private val TOKEN_KEY = stringPreferencesKey("ics_token")
private val ALARM_CODES_KEY = stringSetPreferencesKey("alarm_codes")
private val MONTH_OFFSET_KEY = intPreferencesKey("month_offset")
// The KST year-month that month_offset is relative to. If this no longer
// matches the current month, the stored offset is stale and is ignored so the
// widget falls back to the current month.
private val MONTH_ANCHOR_KEY = stringPreferencesKey("month_anchor")

private fun currentKstMonth(): String {
    val d = LocalDate.now(ZoneId.of("Asia/Seoul"))
    return "%04d-%02d".format(d.year, d.monthValue)
}

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

    // Month widget's displayed-month offset from "current month" (e.g. -1 = last month).
    // Mutated by in-widget < / > buttons; not used by other widgets.
    // The offset is only honoured while its anchor matches the current KST month;
    // once the month rolls over the stored offset is stale, so we default back to
    // the current month (offset 0).
    suspend fun getMonthOffset(context: Context): Int {
        val prefs = context.dataStore.data.first()
        val anchor = prefs[MONTH_ANCHOR_KEY]
        if (anchor != currentKstMonth()) return 0
        return prefs[MONTH_OFFSET_KEY] ?: 0
    }

    suspend fun setMonthOffset(context: Context, offset: Int) {
        context.dataStore.edit {
            it[MONTH_OFFSET_KEY] = offset
            it[MONTH_ANCHOR_KEY] = currentKstMonth()
        }
    }
}
