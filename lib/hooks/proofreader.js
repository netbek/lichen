var _ = require('lodash');
var chalk = require('chalk');
var path = require('path');
var Proofreader = require('proofreader/lib/proofreader');

var dictionariesDir = path.resolve(path.dirname(require.resolve('proofreader/lib/proofreader')), '..', 'dictionaries');

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
        var proofreader = new Proofreader();

        _.forEach(config.proofreader.dictionaries['build-in'], function (dictName) {
          proofreader.addDictionary(
            path.resolve(dictionariesDir, dictName + '.dic'),
            path.resolve(dictionariesDir, dictName + '.aff')
          );
        });

        _.forEach(config.proofreader.dictionaries.custom, function (dictPath) {
          proofreader.addDictionary(dictPath);
        });

        proofreader.setWhitelist(config.proofreader.selectors.whitelist.join(', '));
        proofreader.setBlacklist(config.proofreader.selectors.blacklist.join(', '));
        proofreader.setWriteGoodSettings(config.proofreader['write-good']);

        proofreader.proofread(html)
          .then(function (results) {
            var suggestionsCount = 0;

            _.forEach(results, function (result) {
              var writeGood = result.suggestions.writeGood;
              var spelling = result.suggestions.spelling;

              suggestionsCount += writeGood.length + spelling.length;
            });

            if (suggestionsCount) {
              if (filePath) {
                console.log('Spelling and grammar suggestions', chalk.cyan(filePath));
              }
              else {
                console.log('Spelling and grammar suggestions');
              }

              _.forEach(results, function (result) {
                var writeGood = result.suggestions.writeGood;
                var spelling = result.suggestions.spelling;

                if (writeGood.length || spelling.length) {
                  console.log('  ' + result.text);

                  writeGood.forEach(function (item) {
                    console.log(chalk.yellow('   - ' + item.reason));
                  });

                  spelling.forEach(function (item) {
                    console.log(chalk.green('   - "' + item.word + '" -> ' + item.suggestions.join(', ')));
                  });
                }
              });
            }

            resolve(html);
          });
      });
    }
  };

  return new Hook();
};
