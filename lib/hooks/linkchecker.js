var _ = require('lodash');
var chalk = require('chalk');
var cheerio = require('cheerio');
var Promise = require('bluebird');
var requestPromise = require('request-promise');
var url = require('url');

module.exports = function (config) {
  function Hook() {}

  Hook.prototype = {
    constructor: Hook,
    /**
     *
     * @param {String} html
     * @param {String} filePath
     * @return {Promise}
     */
    run: function (html, filePath) {
      return new Promise(function (resolve, reject) {
        var $ = cheerio.load(html);

        var chunks = $('a').map(function (i, el) {
          var $elm = $(this);
          var href = $elm.attr('href');
          var hrefResolved = url.resolve(config.linkchecker.baseURL, href);

          var text = $elm.text();

          // Replace newline characters with single space character.
          text = text.replace(/(\r\n|\n|\r)+/gm, ' ');

          // Replace multiple whitespace characters with single space character.
          text = text.replace(/\s+/g, ' ');

          text = text.trim();

          return {
            href: href,
            hrefResolved: hrefResolved,
            text: text
          }
        }).get();

        // Remove duplicate chunks.
        chunks = _.uniqBy(chunks, 'hrefResolved');

        // Remove empty chunks.
        chunks = _.filter(chunks, function (chunk) {
          return chunk.hrefResolved.indexOf('://') > -1;
        });

        if (!chunks.length) {
          resolve(html);
          return;
        }

        if (filePath) {
          console.log('Checking links', chalk.cyan(filePath));
        }
        else {
          console.log('Checking links');
        }

        Promise.mapSeries(chunks, function (chunk) {
            return requestPromise({
                uri: chunk.hrefResolved,
                resolveWithFullResponse: true
              })
              .then(function (response) {
                console.log('  ', chalk.green('✓'), chunk.href, chalk.cyan(chunk.text));

                return Promise.resolve();
              })
              .catch(function (response) {
                console.log('  ', chalk.yellow(response.statusCode), chunk.href, chalk.cyan(chunk.text));

                return Promise.resolve();
              });
          })
          .then(function () {
            resolve(html);
          });
      });
    }
  };

  return new Hook();
};
