var Remarkable = require('remarkable');

module.exports = function (data) {
  var md = new Remarkable({
    html: true
  });

  return md.render(data);
};
