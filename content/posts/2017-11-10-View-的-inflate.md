---
layout: post
title:  "View 的 inflate"
date: "2017-11-10"
author: "北邙山之光"
category: "自定义View"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - 自定义View
---




View 的 inflate方法，最终都会调用到
```java
public View inflate(XmlPullParser parser, @Nullable ViewGroup root, boolean attachToRoot) {
        synchronized (mConstructorArgs) {
            final Context inflaterContext = mContext;
            final AttributeSet attrs = Xml.asAttributeSet(parser);
            View result = root;
            try {
                  if (TAG_MERGE.equals(name)) {
                    if (root == null || !attachToRoot) {
                        throw new InflateException("<merge /> can be used only with a valid "
                                + "ViewGroup root and attachToRoot=true");
                    }

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

            }
            return result;
        }
    }
```

<!--more-->
## 分析
ViewGroup root, boolean attachToRoot 这两个参数很重要。

整个流程是，先 createViewFromTag 创建我们的 layout 的根 View,然后根据 root 即父布局的一些参数，得到 params，当我们的 root 不是 null 的时候，这些参数才会被计算出来，所以当我们在 adapter 中的 onCreateView 的时候起布局的时候，如果 root 传入了 null，会收到一个提示

Avoid passing null as the view root (needed to resolve layout parameters on the inflated layout's root element) less...
When inflating a layout, avoid passing in null as the parent view, since otherwise any layout parameters on the root of the inflated layout will be ignored

就是这个原因了！
之后 rInflateChildren 创建所有的子 View 就完成了整个 inflate

而我们看到 attachToRoot
```java
if (root != null && attachToRoot) {
    root.addView(temp, params);
}
if (root == null || !attachToRoot) {
    result = temp;
}
```
只有 attachToRoot 是 true 的时候，才会执行子 View 的添加操作，而如果 root 是 null 或者 attachToRoot 是 false 都只返回一个 layout 的根 View，里面的 View 已经被 add 了，但是整个大的 View(就是我们 inflate 的布局中的所有 View)并没有被父控件所 add。

## 结论
root 是 parent，如果不是 merge 标签那些，会先将我们 inflate 的布局文件初始化出来

+ root == null
  没有 params，不管 attachToRoot 的值，返回那个 inflate 布局文件的整个 View
+ root != null
  有 params
  + attachToRoot = true
    root 会把我们 inflate 的布局加进 root
  + attachToRoot = false
    返回那个 inflate 布局文件的整个 View

## 少情况了
今天写自定义 View 的时候突然发现不对，如果 Inflate 之传入两个参数，其实还是 attachToRoot = true  

我一直以为 attachtoRoot = true 时，才 add 进去，其实两个参数的时候也 add 进去了

代码如下：
```java
public View inflate(XmlPullParser parser, @Nullable ViewGroup root) {
        return inflate(parser, root, root != null);
    }
```
root != null 就是 true!!!
