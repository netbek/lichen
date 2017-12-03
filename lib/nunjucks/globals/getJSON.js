var fs = require('fs-extra');

module.exports = function(src) {
  if (!fs.existsSync(src)) {
    return;
  }

  var str = fs.readFileSync(src, 'utf8');

  return JSON.parse(str);
};
