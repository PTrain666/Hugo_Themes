---
layout: post
title:  "Bundle Parcel 和 ClassLoader"
date: "2021-02-20"
author: "北邙山之光"
category: "Android"
resources:
- name: "featured-image"
  src: "bundle_and_parcel.png"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Android
---

### 前言

前几天看到同事在讨论 `动态代理` 和 `类加载器` 的一些问题，其实这些技术无论是客户端还是后端都已经用烂掉了。

动态代理 `cglib` 和 `jdk.Proxy` 基本是 Java 后端面试的 "八股" 送分题。

类加载器也是 Java 中的基础，八股曰：双亲委派模型 balabala···

安卓中的热修复(DexElements)也都是从类加载器萌发的，其实 tomcat 热部署也依赖于此(这个应该比 Android 的热修早吧)。

不过类加载器让我想起以前一个 `跨进程传数据` 的问题，回顾一下，以免忘记。

### Bundle 和 Parcel

来看一个跨进程传数据的反例

TestData 是传输的数据类型 implements Parcelable。

aidl 接口定义了两个方法，分别传输 TestData 和 Bundle(bundle.putParcelable(TestData)) 类型的数据

```java
// TestService.aidl
interface ITestService {
    void setTestData(in TestData data);
    void setBundle(in Bundle data);
}

// TestData.java
public class TestData implements Parcelable {
  public int data_int;
  public String data_str;

  protected TestData(Parcel in) {
    data_int = in.readInt();
    data_str = in.readString();
  }

  public TestData(int data_int, String data_str) {
    this.data_int = data_int;
    this.data_str = data_str;
  }

  @Override
  public void writeToParcel(Parcel dest, int flags) {
    dest.writeInt(data_int);
    dest.writeString(data_str);
  }

  @Override
  public int describeContents() {
    return 0;
  }

  public static final Creator<TestData> CREATOR = new Creator<TestData>() {
    @Override
    public TestData createFromParcel(Parcel in) {
      return new TestData(in);
    }

    @Override
    public TestData[] newArray(int size) {
      return new TestData[size];
    }
  };
}

// TestService.java
public class TestService extends Service {

  private static final String TAG = "TestService";
  public TestService() {
  }

  private final ITestService.Stub mStub = new ITestService.Stub() {

    @Override
    public void setTestData(TestData data) throws RemoteException {
      Log.e(TAG, "setTestData: " + data.data_str);
    }

    @Override
    public void setBundle(Bundle data) throws RemoteException {
      TestData testData = data.getParcelable("test");
      Log.e(TAG, "setBundle: " + testData.data_str);
    }
  };

  @Override
  public IBinder onBind(Intent intent) {
    return mStub;
  }
}
```

我们创建一个 remote service，然后打印一下收到的数据。

结果会如何呢？

### java.lang.ClassNotFoundException 出现

当我们调用 setTestData() 时，平安无事。

但是当我们调用 setBundle() 时，crash 了，抛出了 ClassNotFoundException。

调用栈如下: 

```txt
java.lang.ClassNotFoundException: com.ptrain.testclassloader.TestData
    at java.lang.Class.classForName(Native Method)
    at java.lang.Class.forName(Class.java:453)
    at android.os.Parcel.readParcelableCreator(Parcel.java:2811)
    at android.os.Parcel.readParcelable(Parcel.java:2765)
    at android.os.Parcel.readValue(Parcel.java:2668)
    at android.os.Parcel.readArrayMapInternal(Parcel.java:3037)
    at android.os.BaseBundle.initializeFromParcelLocked(BaseBundle.java:288)
    at android.os.BaseBundle.unparcel(BaseBundle.java:232)
    at android.os.Bundle.getParcelable(Bundle.java:940)
    at com.ptrain.testclassloader.TestService$1.setBundle(TestService.java:30)
    at com.ptrain.testclassloader.ITestService$Stub.onTransact(ITestService.java:103)
```

#### Bundle 的 ClassLoader

其实 Bundle 依然是个子类，Bundle extends BaseBundle。BaseBundle 默认的 ClassLoader 是 `BootClassLoader`，其为一个单例类且直接继承自 ClassLoader，用于加载一些系统类，所以并不知道 TestData 这个类的存在，这个时候就需要我们指定 ClassLoader。

#### 很少使用的 Bundle.setClassLoader()

其实 Bundle 一直有这么一个方法，但是我从来没使用过。

```java
public void setClassLoader(ClassLoader loader) {
    // 是不是从来都没在意过 Bundle extends BaseBundle
    super.setClassLoader(loader);
}
```

通过这个方法我们可以给 Bundle 设置一个 ClassLoader。

在读取数据前，添加一行代码就可以消灭这个 crash 了。

```java
Bundle.setClassLoader(TestData.class.getClassLoader());
```

### 为什么 setTestData() 没有 crash

是因为 Bundle 的读取过程不同，其实我们同样可以让 TestData crash。

当我们使用 Bundle 获取 Parcelable 对象时，会调用到 Bundle.readParcelableCreator()，此方法最终会通过 Class.forName(String name, boolean initialize, ClassLoader loader) 加载类，loader 就是指定的 ClassLoader。

而当我们获取 TestData 时，在 createFromParcel(Parcel in) 时就已经创建了 TestData 对象，所以不存在读取 Parcelable 的流程，所以没有 crash。

### 让 TestData not found

修改 TestData 的代码，使其一样抛出 ClassNotFoundException。

```java
public class TestData implements Parcelable {
  public int data_int;
  public String data_str;
  // 增加一个 implements Parcelable 的成员变量
  public TestData2 data_test2;

  protected TestData(Parcel in) {
    data_int = in.readInt();
    data_str = in.readString();
    data_test2 = in.readParcelable(TestData2.class.getClassLoader());
  }
}
```

通过 Android Studio 自动补全的代码，我们看到了 `in.readParcelable(TestData2.class.getClassLoader())` 设置 ClassLoader 的地方，这里的设置是正确的，自动补全应该也是怕我们忘记指定 ClassLoader 从而导致的 ClassNotFoundException。

我们只要将 TestData2.class.getClassLoader() 改成 Bundle 的 ClassLoader 即 BootClassLoader 或者随意指定一个自定义的找不到 TestData2 的 ClassLoader 都可以让程序 crash， 抛出 ClassNotFoundException。

### 总结

平时使用的觉得理所应当的东西往往并不是那么简单和单纯。

ClassLoader 最本质的功能就是负责找到类、加载类，其余的诸如版本隔离等等感觉都是衍生品。