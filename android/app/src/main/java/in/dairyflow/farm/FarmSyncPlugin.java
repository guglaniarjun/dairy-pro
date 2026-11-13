package in.dairyflow.farm;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.*;
@CapacitorPlugin(name="FarmSync")
public class FarmSyncPlugin extends Plugin {
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final ExecutorService syncExecutor=Executors.newSingleThreadExecutor();
    interface Action { JSONObject run() throws Exception; }
    private void run(PluginCall call,Action a){executor.execute(()->{try{call.resolve(JSObject.fromJSONObject(a.run()));}catch(Exception e){call.reject(e.getMessage(),e);}});}
    @PluginMethod public void configure(PluginCall call){run(call,()->{
        if(call.getBoolean("reset",false)){
            try(FarmStore store=new FarmStore(getContext())){
                if(store.get("session")!=null||store.list("outbox:").length()>0)throw new Exception("Sign out after syncing every pending entry before changing servers.");
            }
            getContext().getSharedPreferences("farm",0).edit().remove("server").commit();
        }
        String url=call.getString("url");
        if(url!=null){URI uri=new URI(url.trim());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||!(uri.getPath().isEmpty()||uri.getPath().equals("/")))throw new Exception("Enter the HTTPS farm address without a path or password");
            String base=uri.getScheme()+"://"+uri.getAuthority();
            String old=getContext().getSharedPreferences("farm",0).getString("server","");
            if(!old.isEmpty()&&!old.equals(base))throw new Exception("This installation is linked to another server. Sync your entries before clearing app data to change servers.");
            getContext().getSharedPreferences("farm",0).edit().putString("server",base).commit();
            try{
                JSONObject probe=FarmNetwork.request(getContext(),"/api/auth/user","GET",null,null);
                if(!java.util.Arrays.asList(200,401).contains(probe.getInt("status"))||!probe.getString("contentType").contains("application/json"))throw new Exception("This address did not return the DairyFlow sign-in API.");
            }catch(Exception error){getContext().getSharedPreferences("farm",0).edit().putString("server",old).commit();throw new Exception("Cannot connect to this farm. Check the address and internet connection.",error);}
            FarmSyncWorker.schedule(getContext());}
        return new JSONObject().put("url",getContext().getSharedPreferences("farm",0).getString("server",""));});}
    @PluginMethod public void get(PluginCall call){run(call,()->{try(FarmStore s=new FarmStore(getContext())){return new JSONObject().put("value",s.get(call.getString("key"))==null?JSONObject.NULL:s.get(call.getString("key")));}});}
    @PluginMethod public void put(PluginCall call){run(call,()->{try(FarmStore s=new FarmStore(getContext())){s.put(call.getString("key"),call.getString("value"));return new JSONObject();}});}
    @PluginMethod public void remove(PluginCall call){run(call,()->{try(FarmStore s=new FarmStore(getContext())){s.remove(call.getString("key"));return new JSONObject();}});}
    @PluginMethod public void list(PluginCall call){run(call,()->{try(FarmStore s=new FarmStore(getContext())){return new JSONObject().put("entries",s.list(call.getString("prefix","")));}});}
    @PluginMethod public void request(PluginCall call){run(call,()->FarmNetwork.request(getContext(),call.getString("path"),call.getString("method","GET"),call.getString("body"),call.getObject("headers")));}
    @PluginMethod public void upload(PluginCall call){run(call,()->FarmNetwork.request(getContext(),call.getString("path"),call.getString("method","POST"),null,call.getObject("headers"),call.getArray("form")));}
    @PluginMethod public void openDocument(PluginCall call){run(call,()->{
        JSONObject response=FarmNetwork.request(getContext(),call.getString("path"),"GET",null,null);
        if(response.getInt("status")!=200)throw new Exception("The document could not be downloaded. Connect and sign in again.");
        openFile(response.getString("body"),response.getString("contentType"),response.optBoolean("binary"));return new JSONObject();
    });}
    @PluginMethod public void saveDocument(PluginCall call){run(call,()->{openFile(call.getString("data"),call.getString("type","application/pdf"),true);return new JSONObject();});}
    private void openFile(String data,String type,boolean binary) throws Exception {
        String extension=type.contains("pdf")?".pdf":type.contains("spreadsheet")?".xlsx":type.contains("csv")?".csv":".txt";
        java.io.File file=new java.io.File(getContext().getCacheDir(),"DairyFlow-"+System.currentTimeMillis()+extension);
        try(java.io.FileOutputStream out=new java.io.FileOutputStream(file)){out.write(binary?android.util.Base64.decode(data,android.util.Base64.DEFAULT):data.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        android.net.Uri uri=androidx.core.content.FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",file);
        android.content.Intent intent=new android.content.Intent(android.content.Intent.ACTION_VIEW).setDataAndType(uri,type).addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION|android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().runOnUiThread(()->{try{getActivity().startActivity(intent);}catch(Exception e){getActivity().startActivity(android.content.Intent.createChooser(new android.content.Intent(android.content.Intent.ACTION_SEND).setType(type).putExtra(android.content.Intent.EXTRA_STREAM,uri).addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION),"Share DairyFlow report"));}});
    }
    @PluginMethod public void sync(PluginCall call){
        // Network catch-up must not block local saves/cache reads on the bridge queue.
        syncExecutor.execute(()->{try{call.resolve(JSObject.fromJSONObject(FarmNetwork.sync(getContext(),call.getBoolean("refresh",true))));}catch(Exception e){call.reject(e.getMessage(),e);}});
    }
    @PluginMethod public void launchPath(PluginCall call){
        String path=getActivity().getIntent().getStringExtra("farmPath");getActivity().getIntent().removeExtra("farmPath");
        JSObject result=new JSObject();result.put("path","/care?tab=work".equals(path)?path:"");call.resolve(result);
    }
    @PluginMethod public void logout(PluginCall call){
        getActivity().runOnUiThread(()->android.webkit.CookieManager.getInstance().removeAllCookies(removed->{
            try(FarmStore store=new FarmStore(getContext())){store.remove("session");}
            android.webkit.CookieManager.getInstance().flush();call.resolve();
        }));
    }
}
