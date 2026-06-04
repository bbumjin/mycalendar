package com.aicalendar.widget.worker

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.notifications.ReminderScheduler
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.MonthWidget
import com.aicalendar.widget.widgets.NextEventWidget
import com.aicalendar.widget.widgets.TodayWidget
import java.util.concurrent.TimeUnit

class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        // The month widget renders only from its local cache (so taps never block
        // on the network), so the periodic refresh must do the fetching here in
        // the background and write the cache before re-rendering.
        val token = TokenStore.get(applicationContext)
        if (token != null) {
            val ym = TokenStore.getDisplayedMonth(applicationContext)
            runCatching { ApiClient.month(token, ym) }.getOrNull()?.let {
                TokenStore.putMonthCache(applicationContext, ym, it)
            }
        }
        // updateAll() re-runs each widget's provideGlance. Today/Next fetch there;
        // Month now renders from the cache we just refreshed.
        TodayWidget().updateAll(applicationContext)
        NextEventWidget().updateAll(applicationContext)
        MonthWidget().updateAll(applicationContext)
        // Re-schedule local notification alarms for upcoming events.
        ReminderScheduler.sync(applicationContext)
        return Result.success()
    }
}

object RefreshScheduler {
    private const val UNIQUE = "aicalendar-widget-refresh"

    fun schedule(context: Context) {
        val req = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE,
            ExistingPeriodicWorkPolicy.KEEP,
            req
        )
    }
}
