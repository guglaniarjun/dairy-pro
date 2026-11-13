package in.dairyflow.farm;

import android.content.Context;
import android.webkit.CookieManager;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class FarmNetwork {
    public static final Object SYNC_LOCK=new Object();
    private static final okhttp3.OkHttpClient HTTP=new okhttp3.OkHttpClient.Builder()
        .connectTimeout(15,java.util.concurrent.TimeUnit.SECONDS).readTimeout(30,java.util.concurrent.TimeUnit.SECONDS)
        .followRedirects(false).followSslRedirects(false).build();
    public static JSONObject request(Context context,String path,String method,String body,JSONObject headers) throws Exception {
        return request(context,path,method,body,headers,null);
    }
    public static JSONObject request(Context context,String path,String method,String body,JSONObject headers,JSONArray form) throws Exception {
        String base=context.getSharedPreferences("farm",0).getString("server","");
        if(base.isEmpty()) throw new IOException("Set the farm server address first");
        if(!path.startsWith("/api/") || path.contains("\\") || path.contains("..") || path.contains("\r") || path.contains("\n")) throw new IOException("Invalid API path");
        okhttp3.Request.Builder request=new okhttp3.Request.Builder().url(base+path).header("Accept","application/json");
        String cookies=CookieManager.getInstance().getCookie(base);
        if(cookies!=null)request.header("Cookie",cookies);
        if(headers!=null)for(Iterator<String> i=headers.keys();i.hasNext();) {String k=i.next();if(!k.equalsIgnoreCase("cookie")&&!k.equalsIgnoreCase("host"))request.header(k,headers.getString(k));}
        okhttp3.RequestBody payload=null;
        if(form!=null){
            okhttp3.MultipartBody.Builder multipart=new okhttp3.MultipartBody.Builder().setType(okhttp3.MultipartBody.FORM);
            for(int i=0;i<form.length();i++){
                JSONObject field=form.getJSONObject(i);
                if(field.has("file"))multipart.addFormDataPart(field.getString("name"),field.getString("file"),okhttp3.RequestBody.create(android.util.Base64.decode(field.getString("value"),android.util.Base64.DEFAULT),okhttp3.MediaType.parse(field.optString("type","application/octet-stream"))));
                else multipart.addFormDataPart(field.getString("name"),field.getString("value"));
            }
            payload=multipart.build();
        }else if(!method.equals("GET")&&!method.equals("HEAD"))payload=okhttp3.RequestBody.create(body==null?"":body,okhttp3.MediaType.parse("application/json; charset=utf-8"));
        try(okhttp3.Response response=HTTP.newCall(request.method(method,payload).build()).execute()){
            for(String cookie:response.headers("Set-Cookie"))CookieManager.getInstance().setCookie(base,cookie);
            CookieManager.getInstance().flush();
            String contentType=response.header("Content-Type","application/json");
            byte[] bytes=response.body()==null?new byte[0]:response.body().bytes();
            boolean binary=contentType.contains("pdf")||contentType.contains("spreadsheet")||contentType.contains("octet-stream");
            String data=binary?android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP):new String(bytes,StandardCharsets.UTF_8);
            return new JSONObject().put("status",response.code()).put("body",data).put("binary",binary).put("contentType",contentType);
        }
    }

    private static Object resolve(Object value,FarmStore store,String scope) throws Exception {
        if(value instanceof String) {String text=(String)value;if(text.startsWith("pending:")){String mapped=store.get("map:"+scope+":"+text);if(mapped==null)throw new IOException("Waiting for an earlier offline record to sync");return mapped;}return value;}
        if(value instanceof JSONObject){JSONObject copy=new JSONObject();JSONObject o=(JSONObject)value;for(Iterator<String> i=o.keys();i.hasNext();){String k=i.next();copy.put(k,resolve(o.get(k),store,scope));}return copy;}
        if(value instanceof JSONArray){JSONArray a=new JSONArray();for(int i=0;i<((JSONArray)value).length();i++)a.put(resolve(((JSONArray)value).get(i),store,scope));return a;}return value;
    }
    public static JSONObject sync(Context context) throws Exception { return sync(context,true); }
    public static JSONObject sync(Context context,boolean refresh) throws Exception {
        synchronized(SYNC_LOCK) {try(FarmStore store=new FarmStore(context)){
            String saved=store.get("session");if(saved==null)return new JSONObject().put("synced",0);
            JSONObject expected=new JSONObject(saved);
            JSONObject auth=request(context,"/api/auth/user","GET",null,null);
            if(auth.getInt("status")!=200)throw new IOException("Sign in online again to sync pending entries");
            JSONObject user=new JSONObject(auth.getString("body"));
            String scope=expected.optString("id")+":"+expected.optString("tenantId");
            if(!scope.equals(user.optString("id")+":"+user.optString("tenantId")))throw new IOException("The signed-in account or farm changed; pending entries were preserved");
            JSONArray stored=store.list("outbox:"+scope+":");ArrayList<JSONObject> queue=new ArrayList<>();
            for(int i=0;i<stored.length();i++)queue.add(new JSONObject(stored.getJSONObject(i).getString("value")));
            queue.sort(Comparator.comparing(q->q.optString("createdAt")));int count=0;int conflicts=0;
            for(JSONObject q:queue){
                if(q.optBoolean("rejected",false)){conflicts++;continue;}
                String id=q.getString("id"),key="outbox:"+scope+":"+id;
                try {
                    JSONObject body=(JSONObject)resolve(q.getJSONObject("data"),store,scope);
                    String path=q.getString("path");
                    for(String segment:path.split("/"))if(segment.startsWith("pending:"))path=path.replace(segment,(String)resolve(segment,store,scope));
                    JSONObject headers=new JSONObject().put("Idempotency-Key",id).put("X-Farm-ID",user.getString("tenantId"));
                    JSONObject response=request(context,path,q.optString("method","POST"),body.toString(),headers);
                    int status=response.getInt("status");
                    if(status>=500)throw new IOException("Server unavailable; entries remain saved on this phone");
                    if(status==401||status==403){q.put("error","Sign in with the required farm permissions to sync");store.put(key,q.toString());throw new SecurityException("Sign-in or permissions need review");}
                    if(status<200||status>=400){q.put("error",response.getString("body"));q.put("rejected",true);store.put(key,q.toString());conflicts++;continue;}
                    if(status>=300)throw new IOException("The farm server redirected this entry. Check the configured address; the entry remains saved.");
                    String raw=response.getString("body");
                    Object parsed=raw.isEmpty()?new JSONObject():new JSONTokener(raw).nextValue();
                    JSONObject result=parsed instanceof JSONObject?(JSONObject)parsed:new JSONObject();
                    if(result.has("id"))store.put("map:"+scope+":pending:"+id,result.getString("id"));
                    for(String part:new String[]{"cattle","transaction"})if(result.optJSONObject(part)!=null&&result.getJSONObject(part).has("id"))store.put("map:"+scope+":pending:"+id+":"+part,result.getJSONObject(part).getString("id"));
                    // Keep the receipt before removing work so a lost UI acknowledgement is recoverable.
                    store.put("result:"+scope+":"+id,response.toString());store.remove(key);count++;
                }catch(IOException error){q.put("error",error.getMessage());store.put(key,q.toString());if(!error.getMessage().startsWith("Waiting"))throw error;conflicts++;}
            }
            // Refresh every cached API view for the active farm after pushing, including background sync.
            JSONArray cached=refresh?store.list("cache:"+scope+":"):new JSONArray();
            for(int i=0;i<cached.length();i++){String key=cached.getJSONObject(i).getString("key");String path=key.substring(("cache:"+scope+":").length());
                JSONObject response=request(context,path,"GET",null,null);
                if(response.getInt("status")==200&&!response.optBoolean("binary"))store.put(key,new JSONObject().put("savedAt",System.currentTimeMillis()).put("data",new JSONTokener(response.getString("body")).nextValue()).toString());
                else if(response.getInt("status")==403||response.getInt("status")==404)store.remove(key);
            }
            store.put("last-sync:"+scope,String.valueOf(System.currentTimeMillis()));
            return new JSONObject().put("synced",count).put("conflicts",conflicts);
        }}
    }
}
