---
layout: post
title:  "RecyclerView Adapter 的问题"
date: "2021-01-30"
author: "北邙山之光"
category: "Java"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - Java
---

### 前言

因为之前一直写 TV 相关的业务，而 TV 业务多半为列表页展示必然使用 `RecyclerView`，当然我们使用的 `RecyclerView` 经过了一定的改造，处理了焦点和各种奇怪的业务需求，目前写的并不好，后续打算有时间整理重构并梦想开源(因为一开始用了一个开源的 `TVRecyclerView`，问题挺多的)。第一步，就是想重构下 `Adapter`，结果没想到出师不利。

这里的问题，并不是指 `Android` 相关的问题，更不是 `Adapter` 和 `RecyclerView` 的代码问题，而是泛型的问题，参考了两个开源的 `Adapter` 库，最终我也没有一个较好的解决方案。

我先说说用原始的 `Adapter` 为什么不太好，再说说我理想的 `Adapter` 和 创造这个 `Adapter` 遇到的泛型问题(这个才是收获)

### 原始的 Adapter 的缺点

先来看看最原始的 Adapter。  

其实我们在写 RecyclerView 的时候都知道，一种 ViewHolder 对应一种 ViewType，RecyclerView 也是通过拿到 Adapter 中的数据，判断 type 创建对应的 ViewHolder，来看看下面的大家都滚瓜烂熟的 Adapter 的代码和当视图类型过多时遇到的问题。

```java
 @NonNull
  @Override
  public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
      // 通过 getItemViewType 拿到的 viewType 创建对应的 ViewHolder
      // 当视图类型过多时
      switch(viewType) {
          case type1:
            return new Type1ViewHolder();
          case type2:
            return new Type2ViewHolder();
        // 无限多
      }
  }

  @Override
  public void onBindViewHolder(@NonNull RecyclerView.ViewHolder holder, int position) {
      // 根据 position 拿到数据，并持有 onCreateViewHolder 创建的 holder，来做视图(holder 持有 view)和数据的绑定
      // 当视图类型过多时
      if (holder instanceof Type1ViewHolder) {

      } else if (holder instanceof Type2ViewHolder) {

      } else if () { // 无限多

      } else if () { // 无限多

      }
  }

  @Override
  public int getItemViewType(int position) {
    // 根据 postion 拿到 List 数据返回其类型
    // 当视图类型过多时，如果 List 存储的数据自身可以判断类型，倒也不会增加额外代码
  }
```

所以当类型过多的时候，我们需要创建的类 `可能有` Model、ViewHolder等，其实这还算好，但是烦点在于 `onCreateViewHolder` 和 `onBindViewHolder` 中，因为你每加一个 type，就要加一行 switch-case 或者 if-else，类型多了以后，这个类文件的行数会异常的多，目前我司的 Adapter 就是 switch-case 和 if-else 有好多种 type，adapter 代码，嗯，很长···

所以总结一下，我感觉缺点有：

1. 增加了一个类文件的长度(可能会很长)，阅读困难，就是···维护成本高(我好像会用这种吹牛皮的名词了)  

2. 可能会存在漏判断的问题，或者在迁移代码、修改代码时比较困难(虽然也不是那么困难)，就是···维护成本高(我好像会用这种吹牛皮的名词了)

3. 写这种代码会很烦躁，降低程序员的写代码时的愉悦感(我自己瞎说的)

### 理想的 Adapter 的设计

理想是，onCreateViewHolder 和 onBindViewHolder 代码不变动，即 `Adapter 本身代码不变`，只新创建 model 和 ViewHolder。

很多人早就有了这种想法了，开源库很多很多，我看了两个开源库 MultiType([github](https://github.com/drakeet/MultiType)) 和 GenericRecyclerAdapter([github](https://github.com/burakeregar/GenericRecyclerAdapter))。

我在上家公司也做过 Feed 流列表页，也用过 RecyclerView，但是当时是别人写好的架子，我只是增加卡片类型。当时的设计也挺好的，也不用新增判断，但是好像`并不是`一个 ViewHolder 的 class 类型对应一个 ViewType(就是说，10种卡片创建的都是 CommonViewHolder，但是对应的 view 和 data 确是不同的，貌似绑定了两个泛型，太久不记得了)，其实也没什么问题，因为复用的时候判断的是 ViewHolder 实例的 ViewType，并不会出现复用的问题，但是感觉违背了 ViewHolder 的初衷。

所以，这种 Adapter 的思想都差不多，只不过有各自的实现过程不太一致。

核心解决三个问题：

1. viewType 的获取

2. onCreateViewHolder 中根据 viewType 写一段通用的代码创建出对应的 ViewHolder(一般都是有一张表来查 viewType 对用的 ViewHolder 的类型)  

3. onBindViewHolder 中根据 holder 写一段通用代码，做一个类似 bind 的操作，将 holder 和 data 绑定(这里就比较麻烦，需要泛型绑定)

这三个问题也分别对应了 Adapter 中的三个方法。

在我看了上面的两个库后，我选了 MultiType 来自己试试，因为库是 Kotlin 写的，我想着顺便再学一些语法，看看别人都是怎么写 Kotlin 的。但是写着写着就放弃了，改用 java 写了(因为语法不太熟，加上老是和 Golang 记混到底类型声明该放在前面还是后面，导致写的太慢了)，最后切到了 MultiType 的 Java 分支了。

### MultiType 原理

首先，它的假设是，Adapter 中的数据是任意类型的(没有除 Object 外没有共有的父类)，所以存放数据的 List 是 `List<Object>` ，其次有几个关键的类

ItemViewBinder.java

```java
// 绑定了两个泛型，一个是 ViewHolder 子类，一个是任意的 Model 类
public abstract class ItemViewBinder<T, VH extends ViewHolder> {

  /* internal */ MultiTypeAdapter adapter;


  protected abstract @NonNull VH onCreateViewHolder(@NonNull LayoutInflater inflater, @NonNull ViewGroup parent);

  protected abstract void onBindViewHolder(@NonNull VH holder, @NonNull T item);

  // 省略其他代码

}
```

MultiTypePool.java

```java
public class MultiTypePool implements TypePool {
  // 存储 model 类型
  private final @NonNull List<Class<?>> classes;
  // 存储对应 binder
  private final @NonNull List<ItemViewBinder<?, ?>> binders;
  // 省略其他代码
}
```

使用时，代码如下：

```java
MultiTypeAdapter adapter = new MultiTypeAdapter();
adapter.register(Category.class, new CategoryItemViewBinder());
adapter.register(Post.class, new PostViewBinder());
adapter.register(PostList.class, new HorizontalPostsViewBinder());
```

register() 会把 class 和 binder 注册到 MultiTypePool 的两个 List(上图中的 classes 和 binders) 中，这样就存在了一个映射关系。

`getItemViewType()` 通过 position 获取 `List<Object>` 中的 object 对象，再通过其 class 类型查 `MultiTypePool` 中的 classes，返回其 index 作为 viewType。

`onCreateViewHolder()` 通过 viewType(其实就是 classes 和 binders 的 index)，获取 `MultiTypePool` 中的 binder，调用 binder.onCreateViewHolder。

`onBindViewHolder()` 过 position 获取 `List<Object>` 中的 object 对象，再通过其 class 类型查 `MultiTypePool` 中的 classes，返回其 index，再获取 `MultiTypePool` 中的 binder，调用 binder.onBindViewHolder。

所以整个过程，我们只需要`加一行注册代码`，一个基础的 `model` 类和一个 继承 ItemViewBinder 的 `binder`。

还是挺美好的


### 我遇到的泛型问题

我想依葫芦画瓢实现一个一样的 Adapter，因为已经知道了原理，我想自己写一遍，却发现了一些问题。


![](/img/in-post/generic-error.jpg)

这里居然有一个 error！如下：

|  | Required type | Provided|
| :-----:| :----: | :--------: |
| holder | capture of ? extends ViewHolder | ViewHolder |
| item | capture of ? | Object |


代码中，`mTypes.get(position).binder` 这里拿到了 binder，onBindViewHolder 接收两个泛型参数，而 Adapter 给我的 holder 是 ViewHolder 类型，给我的 item 是 Object(因为 `List<Object>`)，Java 编译器不通过，而原作者的代码肯定不会存在编译问题，于是我找了找发现了这段代码。

![](/img/in-post/generic-warning.jpg)

这是原作者的代码，存在一个 warning，提示为 `Raw use of parameterized class 'ItemViewBinder' `

显然编译器是不推荐你这样使用的，因为丢失了类型 `可能存在风险`，上面的我的代码也可以通过这种方式，使得编译通过，但是同样会产生一个 warning。

#### What is a raw type

[stackoverflow](https://stackoverflow.com/questions/2770321/what-is-a-raw-type-and-why-shouldnt-we-use-it)

[JLS 4.8 Raw Types](https://docs.oracle.com/javase/specs/jls/se8/html/jls-4.html#jls-4.8)

不知道该怎么翻译

#### Shouldn't use a raw type 

有个例子

```java
List names = new ArrayList(); // warning: raw type!
names.add("John");
names.add("Mary");
names.add(Boolean.FALSE); // not a compilation error!
for (Object o : names) {
    String name = (String) o;
    System.out.println(name);
} // throws ClassCastException!
  //    java.lang.Boolean cannot be cast to java.lang.String
```

如果你使用 raw type，names 这个 List 就可以接收 Object 类型，所以即使你的`本意是存储一个 string`，但是你却可以`放入一个 bool 值且编译不报错`。但是，一旦到了`运行时`，你读取了 List 中的数据，就会产生 `Exception`。

所以不推荐使用 raw type。

#### 除了 raw type 还要办法吗

无论是原作者的代码还是我的代码都有使用 raw type 的问题，还有 GenericAdapter 等等，许多 Adapter 的开源库可能为了灵活性而使用了 raw type，或者他们也跟我一样依葫芦画瓢，编译通过则万事大吉。

虽然使用了 raw type 并不一定会产生 Exception，因为有时候你可以确定你传进去的就是这些个类型，但是仍然是不推荐的做法，而且 warning 也看着糟心，那有什么办法拯救

有！

在目前的代码基础上的话，只能直接让 binder 使用 Object 和 ViewHolder 类型了，但是这样有一个弊端。就是当你继承 binder 的时候，重写的方法参数就成了 Object 和 ViewHolder 类型了···你`必须要自己加一行 instance of 或者自己加一行强转`，这个我无法接受···因为我都已经确认传进来的一定是对的类型，我居然还要强转一次···而且每次都要加一行这个代码···

还有没有别的办法呢？？

在认为 Adapter 的数据为 `List<Object>` 的情况下(List 容纳多种类型)，我认为(我断言)其实是没有了。

为什么？

因为其实上面的写法本身是存在问题的，ViewHolder 本身也应该绑定泛型，但是因为 binder 绑定了泛型，而 ViewHolder 本身也可以忽略了。那么，如果 List 容纳多种类型，那么 ViewHolder 必须绑定泛型，那么 Adapter 必须绑定泛型。

因为

```java
public class GenericAdapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {

}
```

Adapter 本身就是个泛型类，绑定了 ViewHolder 类型，而我们如果`不自己创建一个 BaseViewHolder<T>` 的话，ViewHolder 永远不会是泛型，onBindViewHolder 那里的参数在不使用 raw type 的前提下，永远传不进去，编译报错。

可一旦 ViewHolder 是泛型，那么上图中的 `GenericAdapter 就要变成 GenericAdapter<T>`。

可一旦这样，代表着 Adapter 只能绑定一种通用的数据类型，不可以是 `List<Object>`，而需要是类似 `List<AllModelInOne>(这个 model 类型本身自己就是多种类型的，可能内部有一个 type 字段判断类型，一个 data 字段才表示其真实数据)` 这种很冗杂的类型。

这样我的 `GenericAdapter 变成 GenericAdapter<T>`，重写部分代码，参数可以传入，也不会存在任何的 raw type 相关的 warning。

但是，这样也有问题，当一个类似 `AllModelInOne` 这种数据存在的时候，感觉会很麻烦，无论是解析 json 的时候，还是到了具体的 bind(AllModelInOne model) 的时候，你还是要自己去判断一些 model 的类型，其实也相当于是在这里强转了。

所以，也并不是什么好的办法。


### 总结

好像绕了一圈，也没有什么好的办法。

唯一的收获是，对于泛型的理解更多了一些。但是还有很多好玩的情形，比如 

> `Double[]` is a subtype of `Number[]`, but a `List<Double>` is NOT a subtype of `List<Number>`

### 2021.02.07 补充

我以为让 Adapter 绑定了泛型，就可以抛开一切的 raw type 或者 unchecked 的 warning，结果我最近真的开始写的时候发现，并不能如愿啊！

问题在于这个 binder 的概念，为了参数类型的确定性(总不能用 object 吧，那就不用泛型了)，这个泛型接口必然绑定了两个泛型，一个是 model，一个是 viewHolder。

而我们还要存储 binder 和 viewType 的映射关系，无论用什么集合存储，这个集合都会同时存(注册 viewType)和取(通过 viewType 获取 binder)

比如使用 List，那么如果 `MyAdapter<T> extends RecyclerView.Adapter<BaseViewHolder<T>>` 则有 `List<Binder<T, BaseViewHolder<T>>>`，这时候外部无法创建一个 `Binder<T, BaseViewHolder<T>>`，因为都是 BaseViewHolder 子类。

如果是 `Binder<T,? extends BaseViewHolder<T>>` 甚至 `Binder<？,?>` 都一样，因为这时候 `onBindViewHolder(BaseViewHolder<T> holder，···)` 类型不对，只能用 raw type 使得编译通过。

如果我们不封装自己的 BaseViewHolder 呢？

那么首先，自己写的 ViewHolder 类的数据类型需要我们自己处理。  

其次，如果想让 onBindViewHolder 的时候没有 warning，那么List 的元素就必须得是 `Binder<T, ViewHolder>`，可是这样注册的时候也会存在问题，所以又一定得是 `Binder<T, ? extends ViewHolder>`，但是 onBindViewHolder 又会 warning···

所以无解。

或许可以保存 Class 类型，反射创建对象，但是反射显然是最后的选择，我宁愿有 warning。