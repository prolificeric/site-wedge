# Wedge

A website proxy that allows you to modify the DOM on the fly.

## How to use it

```javascript
var express = require('express');
var wedge = require('site-wedge');
var app = express();

app.use(wedge({
  protocol: 'http:',
  hostname: 'prolificinteractive.com',
  assets: 'assets/', //Loads static files from this directory
  omit: [
    '/css/site.css' //Removes stylesheet reference
  ],
  append: [
    '/css/styles.css',
    '/js/scripts.js'
  ],
  filter: function (context) {
    context.$('link[href]').remove();
  }
}));

app.listen(process.env.PORT || 9001);
```
