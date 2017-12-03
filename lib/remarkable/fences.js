// Adapted from https://github.com/jonschlinkert/remarkable/blob/e2f22eb5de6ddec4093998824e237b5be951be68/lib/rules_block/fences.js
function parse(state, startLine, endLine, silent) {
  var marker,
    len,
    params,
    nextLine,
    mem,
    haveEndMarker = false,
    pos = state.bMarks[startLine] + state.tShift[startLine],
    max = state.eMarks[startLine];

  if (pos + 3 > max) {
    return false;
  }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x7e /* ~ */ && marker !== 0x60 /* ` */) {
    return false;
  }

  // scan marker length
  mem = pos;
  pos = state.skipChars(pos, marker);

  len = pos - mem;

  if (len < 3) {
    return false;
  }

  params = state.src.slice(pos, max).trim();

  if (params.indexOf('`') >= 0) {
    return false;
  }

  // Since start is found, we can report success here in validation mode
  if (silent) {
    return true;
  }

  // search end of block
  nextLine = startLine;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed block should be autoclosed by end of document.
      // also block seems to be autoclosed by end of parent
      break;
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.tShift[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break;
    }

    if (state.src.charCodeAt(pos) !== marker) {
      continue;
    }

    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue;
    }

    pos = state.skipChars(pos, marker);

    // closing code fence must be at least as long as the opening one
    if (pos - mem < len) {
      continue;
    }

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) {
      continue;
    }

    haveEndMarker = true;
    // found!
    break;
  }

  // If a fence has heading spaces, they should be removed from its inner block
  len = state.tShift[startLine];

  state.line = nextLine + (haveEndMarker ? 1 : 0);

  var type = 'fence';
  var content = state.getLines(startLine + 1, nextLine, len, true);
  var mathMatch = content.match(/(\$\$|\\\[)([^]*)(\$\$|\\\])/);

  // If content is block math.
  if (mathMatch) {
    type = 'math';

    var paramsArr = params.split(/\s+/g);

    // If fence name is not `math`, then make it so.
    if (paramsArr[0].toLowerCase() !== 'math') {
      paramsArr[0] = 'math';
    }

    params = paramsArr.join(' ');

    // Exclude MathJax delimiters.
    content = mathMatch[2];
  }

  state.tokens.push({
    type: type,
    params: params,
    content: content,
    block: true,
    lines: [startLine, state.line],
    level: state.level
  });

  return true;
}

module.exports = function(md) {
  md.block.ruler.at('fences', parse, {
    alt: ['paragraph', 'blockquote', 'list']
  });
};
