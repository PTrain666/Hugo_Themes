---
layout: post
title: "function types"
date: "2018-07-09"
author: "北邙山之光"
category: "go"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - go
---

## function types

> A function type denotes the set of all functions with the same parameter and result types.  
function 类型代表了一系列参数和返回值相同的类型
<!--more-->

## duck typing

golang 中的 interface 就是鸭子类型，实现了 interface 中的方法就可以当做相应的类型使用。

```
type geometry interface {
    area() float64
    perim() float64
}

type rect struct {
    width, height float64
}

type circle struct {
    radius float64
}

func (r rect) area() float64 {
    return r.width * r.height
}

func (r rect) perim() float64 {
    return 2*r.width + 2*r.height
}

func (c circle) area() float64 {
    return math.Pi * c.radius * c.radius
}

func (c circle) perim() float64 {
    return 2 * math.Pi * c.radius
}

func measure(g geometry) {
    fmt.Println(g)
    fmt.Println(g.area())
    fmt.Println(g.perim())
}
func main() {
    r := rect{width: 3, height: 4}
    c := circle{radius: 5}
    measure(r)
    measure(c)
}
```

golang 中只要实现了 interface 相应的方法，就可以被认为是相应的类型。rect 和 circle 实现了 geometry 的方法，所以可以被认为是 geometry 类型，作为 measure 的参数传递进来，而不用像 java 显示声明 implements geometry。

## 强行结合一下

```
type Router interface {
    Route(str string) ()
}

type RouterFunc func(str string) ()

func (f RouterFunc) Route(str string) () {
    return f(str)
}

func testRouter(router Router){
    router.Route("router")
}
func main() {
    gRouterFunc:=RouterFunc(func(str string) {
        fmt.Println("hello "+str)
    })
    gRouterFunc.Route("world")
    testRouter(gRouterFunc)
    //结果
    //hello world
    //hello router
}

```

因为 RouterFunc 是 function 类型，而且还给 RouterFunc 增加了 Router 方法，其实就是我们传进去的 function，所以也是 Router 类型，所以 testRouter 执行没有问题