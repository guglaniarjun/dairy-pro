package in.dairyflow.farm;
import android.content.*;
import android.app.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.*;
import java.util.*;
public class FarmNotices {
    public static void show(Context context) throws Exception {
        try(FarmStore store=new FarmStore(context)) {
            String saved=store.get("session");if(saved==null){NotificationManagerCompat.from(context).cancel(1001);return;}
            JSONObject user=new JSONObject(saved);String scope=user.optString("id")+":"+user.optString("tenantId");
            String cache=store.get("cache:"+scope+":/api/tasks");if(cache==null)return;
            String zone="Asia/Kolkata",preferences=store.get("cache:"+scope+":/api/operations/preferences");
            if(preferences!=null)zone=new JSONObject(preferences).getJSONObject("data").optString("timezone",zone);
            java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);format.setTimeZone(TimeZone.getTimeZone(zone));String today=format.format(new Date());
            JSONArray tasks=new JSONObject(cache).getJSONArray("data");int due=0;String first="";StringBuilder fingerprint=new StringBuilder(today);
            for(int i=0;i<tasks.length();i++){JSONObject task=tasks.getJSONObject(i);String status=task.optString("status"),date=task.optString("dueDate","");
                if(!Arrays.asList("completed","cancelled","excluded").contains(status)&&!date.isEmpty()&&!date.equals("null")&&date.compareTo(today)<=0){due++;fingerprint.append(task.optString("id"));if(first.isEmpty())first=task.optString("title");}}
            NotificationManagerCompat manager=NotificationManagerCompat.from(context);
            if(due==0){manager.cancel(1001);return;}
            if(!manager.areNotificationsEnabled()||fingerprint.toString().equals(store.get("notification:"+scope)))return;
            if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel("farm-work","Farm work reminders",NotificationManager.IMPORTANCE_DEFAULT);context.getSystemService(NotificationManager.class).createNotificationChannel(channel);}
            PendingIntent intent=PendingIntent.getActivity(context,0,new Intent(context,MainActivity.class).putExtra("farmPath","/care?tab=work"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            manager.notify(1001,new NotificationCompat.Builder(context,"farm-work").setSmallIcon(in.dairyflow.farm.R.drawable.ic_farm_notice)
              .setContentTitle("DairyFlow: "+due+" due or overdue actions").setContentText(first).setStyle(new NotificationCompat.BigTextStyle().bigText(first+". Open the app to review saved farm work; sync when connected."))
              .setContentIntent(intent).setAutoCancel(true).build());
            store.put("notification:"+scope,fingerprint.toString());
        }
    }
}
