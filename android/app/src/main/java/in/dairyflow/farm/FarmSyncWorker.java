package in.dairyflow.farm;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
import java.util.concurrent.TimeUnit;
public class FarmSyncWorker extends Worker {
    public FarmSyncWorker(@NonNull Context c,@NonNull WorkerParameters p){super(c,p);}
    @NonNull public Result doWork(){try{FarmNetwork.sync(getApplicationContext());return Result.success();}catch(Exception e){return Result.retry();}}
    public static void schedule(Context context){
        PeriodicWorkRequest work=new PeriodicWorkRequest.Builder(FarmSyncWorker.class,15,TimeUnit.MINUTES)
          .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
          .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("dairyflow-sync",ExistingPeriodicWorkPolicy.KEEP,work);
    }
}
