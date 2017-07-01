var _ = require('lodash');

/**
 *
 * @param   {String} str
 * @returns {String}
 */
module.exports = function (str) {
  return _.trim(str, '-').split('--')[0];
};
