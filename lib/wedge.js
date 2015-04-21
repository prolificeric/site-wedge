var url = require('url');
var express = require('express');
var cheerio = require('cheerio');
var request = require('request');
var _ = require('lodash');
var bodyParser = require('body-parser');

function wedge (options) {
  options = _.defaults(options || {}, {
    protocol: 'http:',
    hostname: null,
    port: undefined,
    assets: null,
    omit: null,
    append: null,
    prepend: null,
    filter: null
  });

  var router = express.Router();
  var omissionMap = {};

  if (options.assets) {
    router.use(express.static(options.assets));
  }

  if (options.omit) {
    _.each(options.omit, function (pathname) {
      omissionMap[url.resolve(options.hostname, pathname)] = true;
    });
  }

  router.use(bodyParser.json());
  router.use(bodyParser.urlencoded({ extended: true }));

  router.use(function (req, resp, next) {
    var origin = url.format({
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port
    });

    var uri = url.format({
      protocol: options.protocol,
      hostname: options.hostname,
      port: options.port,
      pathname: req.originalUrl
    });

    var requestOptions = {
      method: req.method,
      uri: uri,
      rejectUnauthorized: false,
      headers: _.omit(req.headers, [
        'accept-encoding',
        'if-none-match',
        'origin',
        'host',
        'referer'
      ])
    };

    if (req.method.toUpperCase() === 'POST') {
      if (/\/json/.test(req.headers['content-type'])) {
        requestOptions.json = req.body;
      } else {
        requestOptions.form = req.body;
      }
    }

    request(requestOptions, function (err, response) {
      if (err) {
        next(err);
        return;
      }

      var $;
      var headers = _.omit(response.headers, ['content-length']);

      resp.set(headers);

      if (/\/json/.test(response.headers['content-type'])) {
        resp.send(response.body);
        return;
      }

      $ = cheerio.load(response.body)

      // Apply custom filter against context
      if (options.filter) {
        options.filter({
          $: $,
          express: {
            req: req,
            resp: resp
          },
          request: {
            options: requestOptions,
            response: response
          }
        });
      }

      // Remove omitted scripts and stylesheets from DOM
      $('script[src], link[href]').each(function () {
        var $el = $(this);
        var href = $el.attr('href');
        var src = $el.attr('src');
        var uri = url.resolve(requestOptions.uri, href || src);

        if (omissionMap[uri]) {
          $el.remove();
        } else {
          $el.attr(href? 'href': 'src', uri);
        }
      });

      // Inject new scripts and stylesheets into the DOM
      _.each(['append', 'prepend'], function (method) {
        _.each(options[method], function (pathname) {
          var ext =  pathname.split('.').pop();

          if (ext === 'js') {
            $('body')[method]($('<script />').attr('src', pathname));
          } else if (ext === 'css') {
            $('head')[method]($('<link rel="stylesheet" type="text/css" />').attr('href', pathname));
          }
        });
      });

      resp.send($.root().html());
    });
  });

  return router;
}

module.exports = wedge;
