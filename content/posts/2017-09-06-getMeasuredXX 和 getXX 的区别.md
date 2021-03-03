---
layout: post
title:  "getMeasuredXX 和 getXX的区别"
date: "2017-09-06"
author: "北邙山之光"
category: "自定义View"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - 自定义View
---



一直喜欢 copy 代码的后果就是细节不清晰，今天就碰到 getMeasuredWidth 和 getWidth 的问题

自定义 ViewGroup 少不了对 onMeasure 方法的重写，那么在 onMeasure 方法中是无法 getWidth 的！

getWidth 依赖于的是 onlayout 方法，没有执行 onlayout 之前就全是0，而 onMeasure 在 onLayout 之前所以全0

getMeasuredWidth 是可以得到值的，所以不要再傻傻分不清楚了，而 getMeasuredWidth 的值是通过读取 xml 文件生成的，在我们 activity 执行 onCreate 时就已经读取了

<!--more-->

## onCreate中的setContentView
```java
setContentView(R.layout.activity_main);
```

这行代码就是读取 xml 布局文件的过程，查看其源码进入 AppCompatAcitivity 的 setContentView 方法

```java
@Override
   public void setContentView(@LayoutRes int layoutResID) {
       getDelegate().setContentView(layoutResID);
   }
```

## getDelegate
```java
@NonNull
   public AppCompatDelegate getDelegate() {
       if (mDelegate == null) {
           mDelegate = AppCompatDelegate.create(this, this);
       }
       return mDelegate;
   }


   private static AppCompatDelegate create(Context context, Window window,
            AppCompatCallback callback) {
        final int sdk = Build.VERSION.SDK_INT;
        if (BuildCompat.isAtLeastN()) {
            return new AppCompatDelegateImplN(context, window, callback);
        } else if (sdk >= 23) {
            return new AppCompatDelegateImplV23(context, window, callback);
        } else if (sdk >= 14) {
            return new AppCompatDelegateImplV14(context, window, callback);
        } else if (sdk >= 11) {
            return new AppCompatDelegateImplV11(context, window, callback);
        } else {
            return new AppCompatDelegateImplV9(context, window, callback);
        }
    }
```

代码很明确根据 sdk 版本创建不同的实现类，并且他们都是继承的关系，毕竟要兼容扩充，而 setContentView 方法是在 AppCompatDelegateImplV9 中的

## AppCompatDelegateImplV9中的setContentView
```java
@Override
  public void setContentView(int resId) {
      ensureSubDecor();
      ViewGroup contentParent = (ViewGroup) mSubDecor.findViewById(android.R.id.content);
      contentParent.removeAllViews();
      //关键
      LayoutInflater.from(mContext).inflate(resId, contentParent);
      mOriginalWindowCallback.onContentChanged();
  }
```
## inflate
一路调用，最终会调用到
```java
public View inflate(XmlPullParser parser, @Nullable ViewGroup root, boolean attachToRoot) {
        //省略若干
        synchronized (mConstructorArgs) {
          final Context inflaterContext = mContext;
          final AttributeSet attrs = Xml.asAttributeSet(parser);
          Context lastContext = (Context) mConstructorArgs[0];
          mConstructorArgs[0] = inflaterContext;
          View result = root;

                //有关merge标签处理
                if (TAG_MERGE.equals(name)) {
                    rInflate(parser, root, inflaterContext, attrs, false);
                } else {
                    // Temp is the root view that was found in the xml
                    final View temp = createViewFromTag(root, name, inflaterContext, attrs);
                    ViewGroup.LayoutParams params = null;
                    if (root != null) {
                        // Create layout params that match root, if supplied
                        params = root.generateLayoutParams(attrs);
                        if (!attachToRoot) {
                            // Set the layout params for temp if we are not
                            // attaching. (If we are, we use addView, below)
                            temp.setLayoutParams(params);
                        }
                    }
                    // Inflate all children under temp against its context.
                    rInflateChildren(parser, temp, attrs, true);


                    // We are supposed to attach all the views we found (int temp)
                    // to root. Do that now.
                    if (root != null && attachToRoot) {
                        root.addView(temp, params);
                    }

                    // Decide whether to return the root that was passed in or the
                    // top view found in xml.
                    if (root == null || !attachToRoot) {
                        result = temp;
                    }
                }
            return result;
        }
    }
```

注释很清晰，这里也解答了另一个问题，我们在 inflate 的时候的 root 和 attachToRoot 这两个参数的作用

从代码中看，temp 是我们从 xml 读取出来的我们自己设计的布局
+ root = null
很简单，直接返回我们的布局，attachToRoot 这个参数已经无效了
+ root != null
  attachToRoot = false 那我们就返回布局，但是没有 addView 进 root
  attachToRoot = true 我们返回布局并且直接 addView 进 root

其实纠结这两个参数是没有意义的，我们要知道何时 attachToRoot 应该是 false 何时是 true

也很简单，当我们使用的 recyclerview 的子 item 的时候，inflate 显然不能传入 true,因为有 recyclerview 内部肯定对其进行了控制，不需要我们人为的去处理
还有 fragment 创建布局的时候，显然也不应该为 true。

而且 false 和 true 的区别只是一个对于 addView 的控制，明白这个就好了。

还有就是可以 inflate(layout,null) 这样使用的话，本身 studio 也会提示我们会忽略父布局的参数，即使你设置了 match_parent，得到的效果也不是 match_parent 的效果。
