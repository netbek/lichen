var fs = require('fs-extra');
var yaml = require('js-yaml');

module.exports = function (src) {
  if (!fs.existsSync(src)) {
    return;
  }

  var str = fs.readFileSync(src, 'utf8');

  return yaml.safeLoad(str);
};
