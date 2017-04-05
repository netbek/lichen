var sanitizeFilename = require('sanitize-filename');

module.exports = function (data) {
  return sanitizeFilename(data);
};
