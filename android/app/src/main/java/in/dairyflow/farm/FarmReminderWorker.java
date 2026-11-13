package in.dairyflow.farm;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
import java.util.concurrent.TimeUnit;
public class FarmReminderWorker extends Worker {
    public FarmReminderWorker(@NonNull Context c,@NonNull WorkerParameters p){super(c,p);}
    @NonNull public Result doWork(){try{FarmNotices.show(getApplicationContext());return Result.success();}catch(Exception e){return Result.retry();}}
    public static void schedule(Context context){WorkManager.getInstance(context).enqueueUniquePeriodicWork("dairyflow-reminders",ExistingPeriodicWorkPolicy.KEEP,
      new PeriodicWorkRequest.Builder(FarmReminderWorker.class,15,TimeUnit.MINUTES).build());}
}
