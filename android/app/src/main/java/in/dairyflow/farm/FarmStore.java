package in.dairyflow.farm;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.*;

/** App-private durable cache and outbox. The VPS remains authoritative. */
public class FarmStore extends SQLiteOpenHelper {
    public FarmStore(Context c) { super(c, "dairyflow.db", null, 1); }
    public void onCreate(SQLiteDatabase db) { db.execSQL("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); }
    public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) {}
    public synchronized String get(String key) {
        try(Cursor c=getReadableDatabase().rawQuery("SELECT value FROM kv WHERE key=?",new String[]{key})) { return c.moveToFirst()?c.getString(0):null; }
    }
    public synchronized void put(String key,String value) {
        ContentValues v=new ContentValues();v.put("key",key);v.put("value",value);
        if(getWritableDatabase().insertWithOnConflict("kv",null,v,SQLiteDatabase.CONFLICT_REPLACE)<0)
            throw new android.database.sqlite.SQLiteException("Device storage could not save this entry");
    }
    public synchronized void remove(String key) { getWritableDatabase().delete("kv","key=?",new String[]{key}); }
    public synchronized JSONArray list(String prefix) throws JSONException {
        JSONArray out=new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT key,value FROM kv ORDER BY key",null)) {
            while(c.moveToNext()) if(c.getString(0).startsWith(prefix)) out.put(new JSONObject().put("key",c.getString(0)).put("value",c.getString(1)));
        }return out;
    }
}
