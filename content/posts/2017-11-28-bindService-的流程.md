---
layout: post
title:  "bindService 的流程"
date: "2017-11-28"
author: "北邙山之光"
category: "Android"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Android
---




## 目的
主要想分析 onServiceConnected 之后返回的 binder 为什么有时候是 binder 有时候是 binderProxy 的问题。顺带走一遍 bindService 流程

<!--more-->

## bindService流程
### 1-ContextImpl的bindService
Activity 中的 bindService 会走到这个类中，Context 的实现类，之后在 bindService 方法里调用了 bindServiceCommon，相应代码
```java
rivate boolean bindServiceCommon(Intent service, ServiceConnection conn, int flags, Handler
            handler, UserHandle user) {
        IServiceConnection sd;
        if (conn == null) {
            throw new IllegalArgumentException("connection is null");
        }
        if (mPackageInfo != null) {
            sd = mPackageInfo.getServiceDispatcher(conn, getOuterContext(), handler, flags);
        } else {
            throw new RuntimeException("Not supported in system context");
        }
        validateServiceIntent(service);
        try {
            IBinder token = getActivityToken();
            if (token == null && (flags&BIND_AUTO_CREATE) == 0 && mPackageInfo != null
                    && mPackageInfo.getApplicationInfo().targetSdkVersion
                    < android.os.Build.VERSION_CODES.ICE_CREAM_SANDWICH) {
                flags |= BIND_WAIVE_PRIORITY;
            }
            service.prepareToLeaveProcess(this);
            int res = ActivityManagerNative.getDefault().bindService(
                mMainThread.getApplicationThread(), getActivityToken(), service,
                service.resolveTypeIfNeeded(getContentResolver()),
                sd, flags, getOpPackageName(), user.getIdentifier());
            if (res < 0) {
                throw new SecurityException(
                        "Not allowed to bind to service " + service);
            }
            return res != 0;
        } catch (RemoteException e) {
            throw e.rethrowFromSystemServer();
        }
    }
```
可以看到其中会调用 AMN.getDefault 的 bindService 方法，这个都很熟悉了。其实就是 AMS 的 bindService 了

### 2-AMS 的b indService
相关代码
```java
public int bindService(IApplicationThread caller, IBinder token, Intent service,
          String resolvedType, IServiceConnection connection, int flags, String callingPackage,
          int userId) throws TransactionTooLargeException {
      enforceNotIsolatedCaller("bindService");

      // Refuse possible leaked file descriptors
      if (service != null && service.hasFileDescriptors() == true) {
          throw new IllegalArgumentException("File descriptors passed in Intent");
      }

      if (callingPackage == null) {
          throw new IllegalArgumentException("callingPackage cannot be null");
      }

      synchronized(this) {
          return mServices.bindServiceLocked(caller, token, service,
                  resolvedType, connection, flags, callingPackage, userId);
      }
  }
```

调用到 mServices.bindServiceLocked 方法，mServices 是 ActiveServices 类

### 3-ActiveServices 的 bindServiceLocked 方法
此方法有几百行

大致如下
bringUpServiceLocked(这其中如果远程服务的话还要创建进程)->
　　realStartServiceLocked->
　　　　　app.thread.scheduleCreateService和requestServiceBindingsLocked
到这里 app.thread 是 ApplicationThread 也是个 binder，回调到我们应用的进程之中。具体在 ActivityThread 中

### 4-ActivityThread 中的 scheduleCreateService
```java
public final void scheduleCreateService(IBinder token,
               ServiceInfo info, CompatibilityInfo compatInfo, int processState) {
           updateProcessState(processState, false);
           CreateServiceData s = new CreateServiceData();
           s.token = token;
           s.info = info;
           s.compatInfo = compatInfo;

           sendMessage(H.CREATE_SERVICE, s);
       }
```
H 是个 handler，是 ActivityThread 内部类，handleMessage 里面会处理 CREATE_SERVICE 这个 Msg

### 5-handleMessage 相应的处理
```java
private void handleCreateService(CreateServiceData data) {
        // If we are getting ready to gc after going to the background, well
        // we are back active so skip it.
        unscheduleGcIdler();
        LoadedApk packageInfo = getPackageInfoNoCheck(
                data.info.applicationInfo, data.compatInfo);
        Service service = null;
        try {
            java.lang.ClassLoader cl = packageInfo.getClassLoader();
            service = (Service) cl.loadClass(data.info.name).newInstance();
        } catch (Exception e) {
            if (!mInstrumentation.onException(service, e)) {
                throw new RuntimeException(
                    "Unable to instantiate service " + data.info.name
                    + ": " + e.toString(), e);
            }
        }

        try {
            if (localLOGV) Slog.v(TAG, "Creating service " + data.info.name);

            ContextImpl context = ContextImpl.createAppContext(this, packageInfo);
            context.setOuterContext(service);

            Application app = packageInfo.makeApplication(false, mInstrumentation);
            service.attach(context, this, data.info.name, data.token, app,
                    ActivityManagerNative.getDefault());
            service.onCreate();
            mServices.put(data.token, service);
            try {
                ActivityManagerNative.getDefault().serviceDoneExecuting(
                        data.token, SERVICE_DONE_EXECUTING_ANON, 0, 0);
            } catch (RemoteException e) {
                throw e.rethrowFromSystemServer();
            }
        } catch (Exception e) {
            if (!mInstrumentation.onException(service, e)) {
                throw new RuntimeException(
                    "Unable to create service " + data.info.name
                    + ": " + e.toString(), e);
            }
        }
    }

```
先是通过反射创建了实例，然后创建 context，service.attach，之后回调 service 的 onCreate 方法。

### 6-回到3中的 requestServiceBindingsLocked
```java
private final void requestServiceBindingsLocked(ServiceRecord r, boolean execInFg)
        throws TransactionTooLargeException {
    for (int i=r.bindings.size()-1; i>=0; i--) {
        IntentBindRecord ibr = r.bindings.valueAt(i);
        if (!requestServiceBindingLocked(r, ibr, execInFg, false)) {
            break;
        }
    }

```
调用了 requestServiceBindingLocked 方法

### 7-requestServiceBindingLocked
```java
private final boolean requestServiceBindingLocked(ServiceRecord r, IntentBindRecord i,
            boolean execInFg, boolean rebind) throws TransactionTooLargeException {
        if (r.app == null || r.app.thread == null) {
            // If service is not currently running, can't yet bind.
            return false;
        }
        if ((!i.requested || rebind) && i.apps.size() > 0) {
            try {
                bumpServiceExecutingLocked(r, execInFg, "bind");
                r.app.forceProcessStateUpTo(ActivityManager.PROCESS_STATE_SERVICE);
                r.app.thread.scheduleBindService(r, i.intent.getIntent(), rebind,
                        r.app.repProcState);
                if (!rebind) {
                    i.requested = true;
                }
                i.hasBound = true;
                i.doRebind = false;
            } catch (TransactionTooLargeException e) {
                // Keep the executeNesting count accurate.
                if (DEBUG_SERVICE) Slog.v(TAG_SERVICE, "Crashed while binding " + r, e);
                final boolean inDestroying = mDestroyingServices.contains(r);
                serviceDoneExecutingLocked(r, inDestroying, inDestroying);
                throw e;
            } catch (RemoteException e) {
                if (DEBUG_SERVICE) Slog.v(TAG_SERVICE, "Crashed while binding " + r);
                // Keep the executeNesting count accurate.
                final boolean inDestroying = mDestroyingServices.contains(r);
                serviceDoneExecutingLocked(r, inDestroying, inDestroying);
                return false;
            }
        }
        return true;
    }
```
又回到应用所在进程中，调用了 scheduleBindService 方法

### 8-AT 中的 scheduleBindService 方法
最终会调用到 handleBindService 方法
```java
private void handleBindService(BindServiceData data) {
      Service s = mServices.get(data.token);
      if (DEBUG_SERVICE)
          Slog.v(TAG, "handleBindService s=" + s + " rebind=" + data.rebind);
      if (s != null) {
          try {
              data.intent.setExtrasClassLoader(s.getClassLoader());
              data.intent.prepareToEnterProcess();
              try {
                  if (!data.rebind) {
                      IBinder binder = s.onBind(data.intent);
                      ActivityManagerNative.getDefault().publishService(
                              data.token, data.intent, binder);
                  } else {
                      s.onRebind(data.intent);
                      ActivityManagerNative.getDefault().serviceDoneExecuting(
                              data.token, SERVICE_DONE_EXECUTING_ANON, 0, 0);
                  }
                  ensureJitEnabled();
              } catch (RemoteException ex) {
                  throw ex.rethrowFromSystemServer();
              }
          } catch (Exception e) {
              if (!mInstrumentation.onException(s, e)) {
                  throw new RuntimeException(
                          "Unable to bind to service " + s
                          + " with " + data.intent + ": " + e.toString(), e);
              }
          }
      }
  }
```
这里调用了 onBind 方法返回了我们的 binder 对象

然后又通过 binder 到 AMS 进程中调用 publishService 方法中

### 9-AMS 的 publishService 方法
最终会调用到 ActiveServicess 的 publishServiceLocked 其中 c.conn.connected(r.name, service)这句很关键

此时的 service 是 IBinder 对象，是传递了 binder 对象，这才是我想解惑的地方，为什么到了应用进程，自动就能变成 proxy 或者是 Binder 呢？写在后面

connected 之后

```java
private static class InnerConnection extends IServiceConnection.Stub {
    final WeakReference<LoadedApk.ServiceDispatcher> mDispatcher;

    InnerConnection(LoadedApk.ServiceDispatcher sd) {
        mDispatcher = new WeakReference<LoadedApk.ServiceDispatcher>(sd);
    }

    public void connected(ComponentName name, IBinder service) throws RemoteException {
        LoadedApk.ServiceDispatcher sd = mDispatcher.get();
        if (sd != null) {
            sd.connected(name, service); //[见流程19]
        }
    }
}
```

之后一系列的调用到 ServiceDispatcher 中，这是 LoadedApk 的内部类，调用了 doConnected
```java
public void doConnected(ComponentName name, IBinder service) {

            // 省略若干···
            if (old != null) {
                mConnection.onServiceDisconnected(name);
            }
            // If there is a new service, it is now connected.
            if (service != null) {
                mConnection.onServiceConnected(name, service);
            }
        }
```
终于回调到我们的 onServiceConnected 方法了···

## 问题来了
回调到 onServiceConnected 之后，我们都会拿到 binder 对象，调用 asInterface 方法，类似 mService = AIDLService.Stub.asInterface(service)

其实这个时候这个 service 是不是 Proxy 已经被决定了，asInterface 这个方法只是一层包装，都是把这个对象直接使用，只不过调用不同的一套方法。

那么为什么不同进程是 Proxy 呢？

其实是因为 Binder 本身也被跨进程传递了，在这里，根据之前的流程是这样的，如果是远程 service 不同进程，那么我们会创建一个不是 app 所在的进程，然后跨进程和 AMS 通信，传递这个 binder

之后，AMS 再跨进程跟 App 所在进程通讯传递这个 Binder

Binder 底层在传递的时候：
```c++
status_t Parcel::writeStrongBinder(const sp<IBinder>& val)
{
    return flatten_binder(ProcessState::self(), val, this);
}

status_t flatten_binder(const sp<ProcessState>& proc,
    const sp<IBinder>& binder, Parcel* out)
{
    flat_binder_object obj;

    obj.flags = 0x7f | FLAT_BINDER_FLAG_ACCEPTS_FDS;
    if (binder != NULL) {
        IBinder *local = binder->localBinder();
        if (!local) {
            BpBinder *proxy = binder->remoteBinder();
            if (proxy == NULL) {
                LOGE("null proxy");
            }
            const int32_t handle = proxy ? proxy->handle() : 0;
            obj.type = BINDER_TYPE_HANDLE;
            obj.handle = handle;
            obj.cookie = NULL;
        } else {
            obj.type = BINDER_TYPE_BINDER;
            obj.binder = local->getWeakRefs();
            obj.cookie = local;
        }
    } else {
        obj.type = BINDER_TYPE_BINDER;
        obj.binder = NULL;
        obj.cookie = NULL;
    }

    return finish_flatten_binder(binder, obj, out);
}

```
后续还有很多处理，详解在这里

http://blog.csdn.net/windskier/article/details/6625883

总之就是 Binder 在传递的时候会被转化，有 Binder 和 Handle 两种 type，handle 就对应了是 Proxy 对象，所以我们的 service 是远程的时候，传递 Binder 的过程就是如此，会返回一个 proxy

一张图解释：

  ![](/img/in-post/binder_type.png)
