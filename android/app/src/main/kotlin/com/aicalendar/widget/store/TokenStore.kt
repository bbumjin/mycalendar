package com.aicalendar.widget.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.aicalendar.widget.api.MonthResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.ZoneId

private val Context.dataStore by preferencesDataStore(name = "aicalendar_widget")
private val TOKEN_KEY = stringPreferencesKey("ics_token")
private val ALARM_CODES_KEY = stringSetPreferencesKey("alarm_codes")
// Month widget's displayed month, stored as an absolute "yyyy-MM" so the
// in-widget < / > buttons never have to read+increment (which was unreliable
// inside the short-lived action context). MONTH_TARGET_DAY is the KST date the
// target was chosen on: a target is only honoured for the day it was set, so
// every new day the widget defaults back to the current month.
private val MONTH_TARGET_KEY = stringPreferencesKey("month_target")
private val MONTH_TARGET_DAY_KEY = stringPreferencesKey("month_target_day")
// Day the in-widget detail view is showing ("yyyy-MM-dd"), or absent for the
// month grid. Like the month target, honoured only for the KST day it was set.
private val SELECTED_DAY_KEY = stringPreferencesKey("selected_day")
private val SELECTED_DAY_STAMP_KEY = stringPreferencesKey("selected_day_stamp")

// Per-month cache of the month API response (JSON), keyed "month_cache_yyyy-MM".
// Lets the widget paint instantly without waiting on the network.
private val monthCacheJson = Json { ignoreUnknownKeys = true }
private fun monthCacheKey(month: String) = stringPreferencesKey("month_cache_$month")

private fun kstToday(): LocalDate = LocalDate.now(ZoneId.of("Asia/Seoul"))
private fun ym(d: LocalDate): String = "%04d-%02d".format(d.year, d.monthValue)
private fun ymd(d: LocalDate): String = "%04d-%02d-%02d".format(d.year, d.monthValue, d.dayOfMonth)

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

    // The month the widget should display, as "yyyy-MM". Defaults to the current
    // KST month unless the user navigated to another month *today*.
    suspend fun getDisplayedMonth(context: Context): String {
        val prefs = context.dataStore.data.first()
        if (prefs[MONTH_TARGET_DAY_KEY] != ymd(kstToday())) return ym(kstToday())
        return prefs[MONTH_TARGET_KEY] ?: ym(kstToday())
    }

    // Pin the displayed month to an absolute "yyyy-MM" (stamped with today's KST date).
    suspend fun setDisplayedMonth(context: Context, month: String) {
        context.dataStore.edit {
            it[MONTH_TARGET_KEY] = month
            it[MONTH_TARGET_DAY_KEY] = ymd(kstToday())
        }
    }

    // Back to the current month: drop any pinned target.
    suspend fun resetDisplayedMonth(context: Context) {
        context.dataStore.edit {
            it.remove(MONTH_TARGET_KEY)
            it.remove(MONTH_TARGET_DAY_KEY)
        }
    }

    // The day whose detail list the month widget is showing, or null for the grid.
    suspend fun getSelectedDay(context: Context): String? {
        val prefs = context.dataStore.data.first()
        if (prefs[SELECTED_DAY_STAMP_KEY] != ymd(kstToday())) return null
        return prefs[SELECTED_DAY_KEY]
    }

    suspend fun setSelectedDay(context: Context, day: String) {
        context.dataStore.edit {
            it[SELECTED_DAY_KEY] = day
            it[SELECTED_DAY_STAMP_KEY] = ymd(kstToday())
        }
    }

    suspend fun clearSelectedDay(context: Context) {
        context.dataStore.edit {
            it.remove(SELECTED_DAY_KEY)
            it.remove(SELECTED_DAY_STAMP_KEY)
        }
    }

    // --- Month data cache (instant render, network refresh in the background) ---

    suspend fun getMonthCache(context: Context, month: String): MonthResponse? {
        val raw = context.dataStore.data.first()[monthCacheKey(month)] ?: return null
        return runCatching { monthCacheJson.decodeFromString(MonthResponse.serializer(), raw) }.getOrNull()
    }

    suspend fun putMonthCache(context: Context, month: String, resp: MonthResponse) {
        val raw = monthCacheJson.encodeToString(MonthResponse.serializer(), resp)
        context.dataStore.edit { it[monthCacheKey(month)] = raw }
    }
}
