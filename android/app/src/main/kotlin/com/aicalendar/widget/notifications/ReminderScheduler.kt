package com.aicalendar.widget.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.aicalendar.widget.BuildConfig
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.TimeFmt
import java.time.OffsetDateTime

object ReminderScheduler {

    // String.hashCode() can be negative; some OEMs (Samsung) mishandle negative
    // PendingIntent request codes, collapsing them and overwriting each other.
    private fun codeFor(eventId: String, minutes: Int): Int =
        ("$eventId:$minutes").hashCode() and 0x7FFFFFFF

    private fun firePendingIntent(context: Context, code: Int, title: String?, text: String?): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ReminderReceiver.ACTION + ":" + code
            if (title != null) putExtra(ReminderReceiver.EXTRA_TITLE, title)
            if (text != null) putExtra(ReminderReceiver.EXTRA_TEXT, text)
            putExtra(ReminderReceiver.EXTRA_NOTIF_ID, code)
        }
        return PendingIntent.getBroadcast(
            context, code, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun showPendingIntent(context: Context, code: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WEB_BASE_URL + "/calendar"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(
            context, code, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    /** Pull upcoming events and (re)schedule an alarm-clock per reminder. Returns count scheduled. */
    suspend fun sync(context: Context): Int {
        val token = TokenStore.get(context) ?: return 0
        val resp = runCatching { ApiClient.reminders(token) }.getOrNull() ?: return 0
        val am = context.getSystemService(AlarmManager::class.java) ?: return 0
        ReminderReceiver.ensureChannel(context)

        // Cancel previously scheduled alarms.
        TokenStore.getAlarmCodes(context).forEach { code ->
            am.cancel(firePendingIntent(context, code, null, null))
        }

        val now = System.currentTimeMillis()
        val newCodes = mutableSetOf<Int>()

        for (e in resp.events) {
            val startMs = runCatching { OffsetDateTime.parse(e.start_time).toInstant().toEpochMilli() }.getOrNull() ?: continue
            for (r in e.reminders) {
                val triggerAt = startMs - r.minutes_before * 60_000L
                if (triggerAt <= now) continue
                val code = codeFor(e.id, r.minutes_before)
                val whenText = TimeFmt.short(e.start_time)
                val loc = e.location_text?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
                val text = "$whenText 시작${beforeLabel(r.minutes_before)}$loc"
                scheduleAt(context, am, code, triggerAt, e.title, text)
                newCodes.add(code)
            }
        }

        TokenStore.saveAlarmCodes(context, newCodes)
        return newCodes.size
    }

    /**
     * setAlarmClock is exempt from Samsung's app-sleep / Doze suppression (TYPE_ALARM),
     * so it fires reliably even when the app is idle. Falls back to exact-and-idle.
     */
    fun scheduleAt(context: Context, am: AlarmManager, code: Int, triggerAt: Long, title: String, text: String) {
        val pi = firePendingIntent(context, code, title, text)
        try {
            am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showPendingIntent(context, code)), pi)
        } catch (_: Exception) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } catch (_: SecurityException) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
        }
    }

    /** Schedule a test alarm 30 seconds out to verify the firing path on-device. */
    fun scheduleTest(context: Context) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        ReminderReceiver.ensureChannel(context)
        scheduleAt(context, am, 987_654, System.currentTimeMillis() + 30_000L, "테스트 알람", "30초 뒤 알람 — 정상 작동합니다 🔔")
    }

    private fun beforeLabel(min: Int): String = when {
        min <= 0 -> ""
        min < 60 -> " ${min}분 전"
        min < 1440 -> " ${min / 60}시간 전"
        else -> " ${min / 1440}일 전"
    }
}
