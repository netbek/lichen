var _ = require('lodash');

module.exports = function (data) {
  return _.kebabCase(data);
};
