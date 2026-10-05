package ai.agrinexus.audit;
import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.ClipData;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.*;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.ByteArrayInputStream;
import java.util.Set;

/** Packaged offline UI uses the API HTTPS origin and ordinary HttpOnly session cookies. */
public class MainActivity extends Activity {
 private static final String HOST=BuildConfig.AUDIT_HOST, START="https://"+HOST+"/mobile-app/index.html";
 private WebView web;
 private ValueCallback<Uri[]> fileCallback;
 private Uri cameraUri;
 private GeolocationPermissions.Callback locationCallback;
 private String locationOrigin;
 private final Set<String> assets=new java.util.HashSet<>(java.util.Arrays.asList("index.html","app.js","styles.css","core.mjs","manifest.json"));
 @Override public void onCreate(Bundle state){
  super.onCreate(state);web=new WebView(this);web.setBackgroundColor(0xfff1f7f1);setContentView(web);
  web.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  WebSettings settings=web.getSettings();settings.setUserAgentString(settings.getUserAgentString()+" AgIntelAndroid/0.1.0");settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setGeolocationEnabled(true);
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();if(!"https".equals(uri.getScheme())||!HOST.equals(uri.getHost())||!uri.getPath().startsWith("/mobile-app/"))return null;
    String name=uri.getPath().substring("/mobile-app/".length());if(name.isEmpty())name="index.html";
    if(!assets.contains(name))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
    String mime=name.endsWith(".html")?"text/html":name.endsWith(".css")?"text/css":name.endsWith(".json")?"application/json":"text/javascript";
    try{return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream("Offline app asset unavailable.".getBytes()));}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri uri=request.getUrl();return !("https".equals(uri.getScheme())&&HOST.equals(uri.getHost())&&uri.getPath().startsWith("/mobile-app/"));}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;cameraUri=null;
    Intent pick=new Intent(Intent.ACTION_GET_CONTENT);pick.setType("image/*");pick.addCategory(Intent.CATEGORY_OPENABLE);pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
    Intent chooser=Intent.createChooser(pick,"Capture or choose evidence"),camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
    if(camera.resolveActivity(getPackageManager())!=null){try{File dir=new File(getCacheDir(),"camera");dir.mkdirs();File photo=File.createTempFile("audit-",".jpg",dir);cameraUri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".files",photo);camera.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);camera.setClipData(ClipData.newRawUri("Audit photo",cameraUri));chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,new Intent[]{camera});}catch(Exception e){cameraUri=null;}}
    try{startActivityForResult(chooser,100);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;Toast.makeText(MainActivity.this,"No camera or photo picker available",Toast.LENGTH_LONG).show();}return true;
   }
   @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){
    if(!origin.equals("https://"+HOST)&&!origin.equals("https://"+HOST+"/")){callback.invoke(origin,false,false);return;}
    if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED){callback.invoke(origin,true,false);return;}
    locationCallback=callback;locationOrigin=origin;requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},101);
   }
  });web.loadUrl(START);
 }
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode!=100||fileCallback==null)return;Uri[] results=null;if(resultCode==RESULT_OK){if(data!=null&&data.getClipData()!=null){ClipData clip=data.getClipData();results=new Uri[clip.getItemCount()];for(int i=0;i<results.length;i++)results[i]=clip.getItemAt(i).getUri();}else if(data!=null&&data.getData()!=null)results=new Uri[]{data.getData()};else if(cameraUri!=null)results=new Uri[]{cameraUri};}fileCallback.onReceiveValue(results);fileCallback=null;}
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grants){super.onRequestPermissionsResult(requestCode,permissions,grants);if(requestCode==101&&locationCallback!=null){boolean granted=false;for(int g:grants)if(g==PackageManager.PERMISSION_GRANTED)granted=true;locationCallback.invoke(locationOrigin,granted,false);locationCallback=null;}}
 @Override protected void onPause(){super.onPause();CookieManager.getInstance().flush();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('online'))",null);}
 @Override public void onBackPressed(){web.evaluateJavascript("document.querySelector('[data-nav=home]')?.click()",null);}
}
