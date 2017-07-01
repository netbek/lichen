var globPromise = require('glob-promise');
var Promise = require('bluebird');

/**
 *
 * @param   {Array} patterns
 * @param   {Object} options
 * @returns {Promise}
 */
module.exports = function (patterns, options) {
  var result = [];

  return Promise.mapSeries(patterns, function (pattern) {
      return globPromise(pattern, options)
        .then(function (files) {
          result = result.concat(files);
        });
    })
    .then(function () {
      return Promise.resolve(result);
    });
};
