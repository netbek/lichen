var _ = require('lodash');
var chalk = require('chalk');
var cheerio = require('cheerio');
var Promise = require('bluebird');
var requestPromise = require('request-promise');
var url = require('url');
var validator = require('validator');

module.exports = function(config) {
  var baseUrl = _.get(config.linkchecker, 'baseURL', '');
  var ignoreFragments = _.get(config.linkchecker, 'ignoreFragments', true);
  var schemes = _.get(config.linkchecker, 'schemes', ['http', 'https']);

  /**
   *
   * @param  {String} uri
   * @return {String}
   */
  function getScheme(uri) {
    var index = uri.indexOf('://');

    if (index < 0) {
      return;
    }

    return uri.substring(0, index);
  }

  /**
   *
   * @param  {String} str
   * @return {String}
   */
  function sanitizeText(str) {
    // Replace newline characters with single space character.
    str = str.replace(/(\r\n|\n|\r)+/gm, ' ');

    // Replace multiple whitespace characters with single space character.
    str = str.replace(/\s+/g, ' ');

    return str.trim();
  }

  function Hook() {}

  Hook.prototype = {
    constructor: Hook,
    /**
     *
     * @param {String} html
     * @param {String} filePath
     * @return {Promise}
     */
    run: function(html, filePath) {
      return new Promise(function(resolve, reject) {
        var chunks = [];
        var $ = cheerio.load(html);

        $('a').each(function(i, el) {
          var $elm = $(this);
          var href = $elm.attr('href');

          if (ignoreFragments && /^(#|\/#)/i.test(href)) {
            return;
          }

          var hrefResolved;

          if (validator.isFQDN(href)) {
            hrefResolved = _.trim(baseUrl, '/');
            if (baseUrl.length > 0) {
              hrefResolved += '/';
            }
            hrefResolved += href;
          } else {
            hrefResolved = url.resolve(baseUrl, href);
          }

          var scheme = getScheme(hrefResolved);

          if (
            _.isUndefined(scheme) ||
            schemes.indexOf(scheme.toLowerCase()) < 0
          ) {
            return;
          }

          var text = sanitizeText($elm.text());

          chunks.push({
            href: href,
            hrefResolved: hrefResolved,
            text: text
          });
        });

        // Remove duplicate chunks.
        chunks = _.uniqBy(chunks, 'hrefResolved');

        if (!chunks.length) {
          resolve(html);
          return;
        }

        if (filePath) {
          console.log('Checking links', chalk.cyan(filePath));
        } else {
          console.log('Checking links');
        }

        Promise.mapSeries(chunks, function(chunk) {
          return requestPromise({
            uri: chunk.hrefResolved,
            resolveWithFullResponse: true
          })
            .then(function(response) {
              var $ = cheerio.load(response.body);
              var title = sanitizeText($('head > title').text());

              console.log(
                '  ',
                chalk.green('✓'),
                chunk.href,
                '(' + chunk.text + ')',
                chalk.cyan('(' + title + ')')
              );

              return Promise.resolve();
            })
            .catch(function(response) {
              console.log(
                '  ',
                chalk.yellow(response.statusCode),
                chalk.yellow(chunk.hrefResolved),
                chunk.href
              );

              return Promise.resolve();
            });
        }).then(function() {
          resolve(html);
        });
      });
    }
  };

  return new Hook();
};
