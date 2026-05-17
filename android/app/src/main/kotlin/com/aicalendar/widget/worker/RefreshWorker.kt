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
import com.aicalendar.widget.widgets.MonthWidget
import com.aicalendar.widget.widgets.NextEventWidget
import com.aicalendar.widget.widgets.TodayWidget
import java.util.concurrent.TimeUnit

class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        // updateAll() re-runs each widget's provideGlance which re-fetches from API
        TodayWidget().updateAll(applicationContext)
        NextEventWidget().updateAll(applicationContext)
        MonthWidget().updateAll(applicationContext)
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
