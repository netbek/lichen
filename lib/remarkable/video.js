var _ = require('lodash');
var nunjucks = require('nunjucks');
var parseMediaUrl = require('../util').parseMediaUrl;
var path = require('path');

// %[alt](src)
var regex = /^%\[([^\]]*)\]\s*\(([^)]+)\)/;
// %[alt](src width height)
var srcSizeRegex = /^(.+)\s+(\d+)\s+(\d+)/;
// %[alt](src width height "title")
var srcSizeTitleRegex = /^(.+)\s+(\d+)\s+(\d+)\s+"([^"]*)"+/;

function parse(state, startLine, endLine, silent) {
  var pos = state.bMarks[startLine] + state.tShift[startLine];
  var max = state.eMarks[startLine];
  var ch = state.src[pos];

  if (ch !== '%') {
    return false;
  }

  var match = regex.exec(state.src.slice(pos));

  if (!match) {
    return false;
  }

  if (silent) {
    return true;
  }

  var alt = match[1];
  var srcSizeMatch = srcSizeRegex.exec(match[2]);
  var srcSizeTitleMatch = srcSizeTitleRegex.exec(match[2]);
  var src;
  var width;
  var height;
  var title;

  if (srcSizeTitleMatch) {
    src = srcSizeTitleMatch[1];
    width = srcSizeTitleMatch[2];
    height = srcSizeTitleMatch[3];
    title = srcSizeTitleMatch[4];
  }
  else if (srcSizeMatch) {
    src = srcSizeMatch[1];
    width = srcSizeMatch[2];
    height = srcSizeMatch[3];
  }
  else {
    src = match[2];
  }

  state.line = startLine + 1;

  state.tokens.push({
    type: 'video',
    alt: alt,
    title: title,
    src: src,
    width: width,
    height: height,
    level: state.level
  });

  return true;
}

module.exports = function (md) {
  md.block.ruler.after('code', 'video', parse);

  md.renderer.rules.video = function (tokens, idx, options, env) {
    var srcParsed = parseMediaUrl(tokens[idx].src);
    var mediaId = srcParsed.mediaId;
    var type = srcParsed.type;

    if (type === 'youtube') {
      var templateFile = path.resolve(md.config.src, '_includes', 'video.njk');

      return nunjucks.render(templateFile, {
        type: type,
        mediaId: mediaId,
        width: _.get(tokens[idx], 'width', 640),
        height: _.get(tokens[idx], 'height', 360),
        title: tokens[idx].title
      });
    }

    return '\n';
  };

  return md;
};
