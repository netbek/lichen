var _ = require('lodash');
var fs = require('fs');
var isLiteral = require('nlcst-is-literal');
var nodehun = require('nodehun');
var path = require('path');
var Promise = require('bluebird');
var quote = require('quotation');
var toString = require('nlcst-to-string');
var validator = require('validator');
var visit = require('unist-util-visit');

var dictionariesDir = path.resolve(__dirname, '..', '..', 'dictionaries');
var affPath = path.resolve(dictionariesDir, 'en_GB' + '.aff');
var dicPath = path.resolve(dictionariesDir, 'en_GB' + '.dic');
var aff = fs.readFileSync(affPath);
var dic = fs.readFileSync(dicPath);
var dictionary = new nodehun(aff, dic);

// @see https://github.com/ben-ng/convert-units
var units = [
  'mm',
  'cm',
  'm',
  'km',
  'in',
  'yd',
  'ft',
  'mi',
  'mm2',
  'cm2',
  'm2',
  'ha',
  'km2',
  'in2',
  'ft2',
  'ac',
  'mi2',
  'mcg',
  'mg',
  'g',
  'kg',
  'oz',
  'lb',
  'mm3',
  'cm3',
  'ml',
  'l',
  'm3',
  'km3',
  'tsp',
  'Tbs',
  'in3',
  'fl-oz',
  'cup',
  'pnt',
  'qt',
  'gal',
  'ft3',
  'yd3',
  'ea',
  'C',
  'K',
  'F',
  'ms',
  's',
  'min',
  'h',
  'd',
  // 'week',
  // 'month',
  // 'year',
  'b',
  'Kb',
  'Mb',
  'Gb',
  'Tb',
  'B',
  'KB',
  'MB',
  'GB',
  'TB',
  'ppm',
  'ppb',
  'ppt',
  'ppq'
].join('|');

var globalCache = [];

function spell(retext, options) {
  var source = 'retext-spell';

  var ignore = _.get(options, 'ignore', []);
  var ignoreDigits = _.get(options, 'ignoreDigits', true);
  var ignoreLiteral = _.get(options, 'ignoreLiteral', true);
  var ignoreUnits = _.get(options, 'ignoreUnits', true);
  var ignoreCurrency = _.get(options, 'ignoreCurrency', true);
  var ignoreEmail = _.get(options, 'ignoreEmail', true);
  var ignoreFqdn = _.get(options, 'ignoreFQDN', true);
  var ignoreUrl = _.get(options, 'ignoreURL', true);
  var checkAllOccurrences = _.get(options, 'checkAllOccurrences', false);

  /**
   *
   * @param  {String} word
   * @return {Boolean}
   */
  function shouldIgnore(word) {
    return (
      _.includes(ignore, word.toLowerCase()) ||
      (ignoreDigits && /^\d+$/.test(word))
    );
  }

  /**
   *
   * @param  {String} word
   * @return {Promise}
   */
  function checkSpelling(word) {
    return new Promise(function(resolve, reject) {
      dictionary.spellSuggestions(word, function(
        err,
        correct,
        suggestions,
        origWord
      ) {
        if (err) {
          reject(err);
        } else if (correct) {
          resolve(true);
        } else {
          resolve({
            word: word,
            suggestions: suggestions
          });
        }
      });
    });
  }

  return function(tree, file) {
    var nodes = [];

    // @see https://github.com/sparkartgroup/quality-docs (MIT license)
    if (
      ignoreCurrency ||
      ignoreEmail ||
      ignoreFqdn ||
      ignoreUrl ||
      ignoreUnits
    ) {
      visit(tree, 'WordNode', function(node, index, parent) {
        var word = toString(node);

        // @todo Optimise
        var unitFilter = new RegExp(
          '^\\d+(' + units + ')+\\d*(' + units + ')*$',
          'i'
        );

        if (
          (ignoreCurrency && validator.isCurrency(word)) ||
          (ignoreEmail && validator.isEmail(word)) ||
          (ignoreFqdn && validator.isFQDN(word)) ||
          (ignoreUrl && validator.isURL(word)) ||
          (ignoreUnits && unitFilter.test(word))
        ) {
          parent.children[index] = {
            type: 'SourceNode',
            value: word,
            position: node.position
          };
        }
      });
    }

    visit(tree, 'WordNode', function(node, index, parent) {
      var word = toString(node);

      if (!checkAllOccurrences && globalCache.indexOf(word) > -1) {
        return;
      }

      if (ignoreLiteral && isLiteral(parent, index)) {
        return;
      }

      if (shouldIgnore(word)) {
        return;
      }

      nodes.push(node);

      if (!checkAllOccurrences) {
        globalCache.push(word);
      }
    });

    return Promise.mapSeries(nodes, function(node) {
      var word = toString(node);

      return checkSpelling(word).then(function(result) {
        if (true !== result) {
          var reason = quote(result.word, '`') + ' is misspelt';

          if (result.suggestions.length) {
            reason +=
              '; did you mean ' +
              quote(result.suggestions, '`').join(', ') +
              '?';
          }

          var message = file.message(reason, node, source);
          message.source = source;
        }

        return Promise.resolve();
      });
    });
  };
}

module.exports = spell;
