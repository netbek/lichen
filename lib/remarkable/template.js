var _ = require('lodash');
var nunjucks = require('nunjucks');
// @todo Make render macro available in Nunjucks outside of Markdown too
var renderMacro =
  '{%- macro render(partial, data, filter) %}{%- render partial, data, filter %}{%- endrender %}{%- endmacro %}';

module.exports = function(md) {
  md.renderer.rules.fence_custom.template = function(
    tokens,
    idx,
    options,
    env,
    instance
  ) {
    var content = renderMacro + tokens[idx].content;
    var template = nunjucks.compile(content, md.nunjucksEnv);

    return template.render();
  };

  return md;
};
