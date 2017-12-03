// Adapted from https://github.com/jonschlinkert/remarkable/blob/e2f22eb5de6ddec4093998824e237b5be951be68/lib/rules_inline/backticks.js
function parse(state, silent) {
  var start,
    max,
    marker,
    matchStart,
    matchEnd,
    pos = state.pos,
    ch = state.src.charCodeAt(pos);

  if (ch !== 0x60 /* ` */) {
    return false;
  }

  start = pos;
  pos++;
  max = state.posMax;

  while (pos < max && state.src.charCodeAt(pos) === 0x60 /* ` */) {
    pos++;
  }

  marker = state.src.slice(start, pos);

  matchStart = matchEnd = pos;

  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60 /* ` */) {
      matchEnd++;
    }

    if (matchEnd - matchStart === marker.length) {
      if (!silent) {
        var type = 'code';
        var content = state.src
          .slice(pos, matchStart)
          .replace(/[ \n]+/g, ' ')
          .trim();
        var mathMatch = content.match(/(\$|\\\()([^]*)(\$|\\\))/);

        // If content is inline math.
        if (mathMatch) {
          type = 'math';
          // Exclude MathJax delimiters.
          content = mathMatch[2];
        }

        state.push({
          type: type,
          content: content,
          block: false,
          level: state.level
        });
      }
      state.pos = matchEnd;
      return true;
    }
  }

  if (!silent) {
    state.pending += marker;
  }
  state.pos += marker.length;
  return true;
}

module.exports = function(md) {
  md.inline.ruler.at('backticks', parse);
};
