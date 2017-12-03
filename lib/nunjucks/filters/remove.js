var cheerio = require('cheerio');

module.exports = function(data, selector) {
  var $ = cheerio.load(data);
  $(selector).remove();

  return $.html();
};
