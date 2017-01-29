var _ = require('lodash');
var chalk = require('chalk');
var cheerio = require('cheerio');
var equality = require('retext-equality');
var intensify = require('retext-intensify');
var path = require('path');
var Promise = require('bluebird');
var readability = require('retext-readability');
var retext = require('retext');
var simplify = require('retext-simplify');
var spell = require(path.resolve(__dirname, '..', 'retext', 'spell'));

module.exports = function (config) {
  var blacklist = config.retext.selectors.blacklist.join(', ');
  var whitelist = config.retext.selectors.whitelist.join(', ');

  var plugins = _.map(config.retext.rules, function (options, name) {
    if ('equality' === name) {
      return [equality, options];
    }
    else if ('intensify' === name) {
      return [intensify];
    }
    else if ('readability' === name) {
      return [readability, options];
    }
    else if ('simplify' === name) {
      return [simplify];
    }
    else if ('spell' === name) {
      return [spell, options];
    }
    else {
      throw new Error('Rule `' + name + '` is not supported');
    }
  });

  /**
   *
   * @param  {String} text
   * @param  {String} filePath
   * @return {Promise}
   */
  function checkChunk(text, filePath) {
    return new Promise(function (resolve, reject) {
      retext()
        .use(plugins)
        .process(text, function (err, file) {
          if (file.messages.length) {
            var messages = _.map(file.messages, function (message) {
              return {
                source: message.source,
                message: message.message
              };
            });

            messages = _.uniqWith(messages, _.isEqual);

            if (filePath) {
              console.log('Spelling and grammar suggestions', chalk.cyan(filePath));
            }
            else {
              console.log('Spelling and grammar suggestions');
            }

            console.log('  ' + text);

            _.forEach(messages, function (message) {
              var color = 'retext-spell' === message.source ? 'yellow' : 'green';
              console.log(chalk[color]('   - ' + message.message));
            });
          }

          resolve();
        });
    });
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
    run: function (html, filePath) {
      return new Promise(function (resolve, reject) {
        var $ = cheerio.load(html);

        if (blacklist) {
          $(blacklist).remove();
        }

        var chunks = $(whitelist).map(function (i, el) {
          var text = $(this).text();

          // Replace newline characters with single space character.
          text = text.replace(/(\r\n|\n|\r)+/gm, ' ');

          // Replace multiple whitespace characters with single space character.
          text = text.replace(/\s+/g, ' ');

          text = text.trim();

          return text;
        }).get();

        // Remove empty chunks.
        chunks = _.filter(chunks, function (chunk) {
          return chunk.length > 0;
        });

        Promise.mapSeries(chunks, function (chunk) {
            return checkChunk(chunk, filePath);
          })
          .then(function () {
            resolve(html);
          });
      });
    }
  };

  return new Hook();
};
