var _ = require('lodash');
var glob = require('glob');

/**
 *
 * @param   {Array} patterns
 * @param   {Object} options
 * @returns {Array}
 */
module.exports = function (patterns, options) {
  var result = [];

  _.forEach(patterns, function (pattern) {
    result = result.concat(glob.sync(pattern, options));
  });

  return result;
};
