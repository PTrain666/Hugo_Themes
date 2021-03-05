---
layout: post
title:  "http 的 post 的 form-data 和 MIME 的秘密"
date: "2019-07-02"
author: "北邙山之光"
excerpt_separator: <!--more-->
catalog: true  
tags: 
    - 基础
    - http
---

## 问题描述

需要上传一张图片到我们的对象存储服务器，对方给了接口协议。  

需使用 post 请求，Content-Type 为 multipart/form-data

且 key = filecontent，value 就是文件内容

#### nodejs

node.js发送请求，就是这么简单

```js
  const options = {
    method: "POST",
    url: "xxxxxxxxxxxxx",
    headers: {
      "Content-Type": "multipart/form-data"
    },
    timeout: 3000,
    formData: {
      // key:filecontent value:stream
      "filecontent": fs.createReadStream(zip_file_path)
    }
  };
  request(options, function (err, res, body) {
    if (err) {
      console.log(err);
    } else {
      let data = JSON.parse(body);
      if (data.errcode) {
        console.log(data)
      } else {
        console.log('cdn链接:\t' + data.download_url);
      }
    }
  });
```

#### golang

当需要在 golang 上发送这个请求的时候，就遇到了各种问题  

往上搜到了各种并不理解的方法，诸如，multipart.createFormFile 等等。不是很理解就算了，抄下来关键是还不对。

是时候学一波 HTTP 协议了

+ golang 如何发送 post 请求,构建 multipart/form-data
```js
buf := new(bytes.Buffer)
w := multipart.NewWriter(buf)
http.NewRequest("POST", GIFT_URL, buf)
contentType := w.FormDataContentType()
req.Header.Set("Content-Type", contentType)
```
上面简单列举了一下 net/http 包自带的几个关键方法

`如果这样就结束了，那我就不会写这篇文章了！`

即使你设置了你的 Content-Type 是 multipart/form-data，即使你 debug 看到你的 body 里面有这个文件的所有数据，但是对方服务器还是`不一定`能解出来。比如，对方服务器是个对象存储系统，并且对上传的文件类型有严格判断，这样的话，肯定是凉凉的。

## 抓包看协议

先来看正确的请求

![](/img/in-post/mime_ok.jpg)

再来看一个出错的golang代码的请求

![](/img/in-post/mime_error.jpg)


#### MIME

上图中可以看到，HTTP 协议之后，还带上了一个 MIME 协议。当我们的 HTTP 的 Content-Type 设置为 multipart/form-data 时，我们的请求后会跟着 MIME 协议。这是对于 HTTP 协议的扩展，通过搜资料，说是以前 HTTP 不能传送各种文件等等的东西，而 MIME 是邮件协议，对 HTTP 进行了扩展，让 HTTP 也可以传输各种文件等资源。

#### 看到问题的本质

那既然抓包发现了 MIME，那么也很清晰的看到了 golang 发出的请求的错误原因，没有指定 MIME 的 Content-Type

| 类型 | 描述 | 典型示例 |
| ------ | ------ | ------ |
| text | 表明文件是普通文本，理论上是人类可读 | text/plain, text/html, text/css, text/javascript |
| `image`	| 表明是某种图像。不包括视频，但是动态图（比如动态gif）也使用image类型	| image/gif, image/png, image/jpeg, image/bmp, image/webp, image/x-icon, image/vnd.microsoft.icon|
| audio	| 表明是某种音频文件 | 	audio/midi, audio/mpeg, audio/webm, audio/ogg, audio/wav|
| video	| 表明是某种视频文件 | 	video/webm, video/ogg | 
| application | 表明是某种二进制数据 | application/octet-stream, application/pkcs12, application/vnd.mspowerpoint, application/xhtml+xml, application/xml,  application/pdf |	

那我们上传图片则 Content-Type 肯定是 image/xxx

#### boundary是什么

我们在抓到的包中还会看到有个叫做 boundary 的一串字符串，这个其实是一个分隔符，让我们能正确解析上传的文件  

一个请求的具体信息大致如下

```js
Content-Type: multipart/form-data; boundary=aBoundaryString
(other headers associated with the multipart document as a whole)

--aBoundaryString
Content-Disposition: form-data; name="myFile"; filename="img.jpg"
Content-Type: image/jpeg

(data)
--aBoundaryString
Content-Disposition: form-data; name="myField"

(data)
--aBoundaryString
(more subparts)
--aBoundaryString--
```

每个字段/文件都被 `boundary`（Content-Type中指定）分成单独的段

#### Content-Disposition是什么

在常规的HTTP应答中，`Content-Disposition` 消息头指示回复的内容该以何种形式展示，是以内联的形式（即网页或者页面的一部分），还是以附件的形式下载并保存到本地。

作为 multipart body 中的消息头时，第一个参数总是固定不变的form-data；附加的参数不区分大小写，并且拥有参数值，参数名与参数值用等号(=)连接，参数值用双引号括起来。参数之间用分号(;)分隔，如之前的图。

## 修正后的代码

那其实核心原因就是 MIME 的 Content-Type 了，我们的对象存储服务器，只接受一般的图片类型，要加上图片文件的类型。
```js
imageData, _ := base64.StdEncoding.DecodeString(imageDataStr)
buf := new(bytes.Buffer)
w := multipart.NewWriter(buf)
hash := md5.Sum(imageData)
baseFileName := filepath.Base(hex.EncodeToString(hash[:]) + ext)
header := make(textproto.MIMEHeader)
header.Set("Content-Disposition",
	fmt.Sprintf(`form-data; name="%s"; filename="%s"`,
		"filecontent", baseFileName))
mimeType := mime.TypeByExtension(ext)
if mimeType == "" {
	mimeType = "application/octet-stream"
}
header.Set("Content-Type", mimeType)
fw, err := w.CreatePart(header)
if err != nil {
	c.EchoError(wr, r, err, -1)
	return
}
_, err = io.Copy(fw, strings.NewReader(string(imageData)))
if err != nil {
	c.EchoError(wr, r, err, -1)
	return
}
contentType := w.FormDataContentType()
w.Close()
req, err := http.NewRequest("POST", GIFT_URL, buf)

```