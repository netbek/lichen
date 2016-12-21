var _ = require('lodash');
var cheerio = require('cheerio');
var fs = require('fs');
var mkdirp = require('mkdirp');
var multiGlob = require('./util').multiGlob;
var nunjucks = require('nunjucks');
var path = require('path');
var Penrose = require('penrose').Penrose;
var Promise = require('bluebird');
var Remarkable = require('remarkable');
var toc = require('markdown-toc');
var yaml = require('js-yaml');

Promise.promisifyAll(fs);

fs.existsAsync = Promise.promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists);
  });
});

var mkdirpAsync = Promise.promisify(mkdirp);

var nunjucksEnv = nunjucks.configure();

var contentDirname = 'content';
var contentExtnames = [
  'md'
];

var dataDirname = 'data';
var dataExtnames = [
  'json',
  'yaml',
  'yml'
];

var templateDirname = 'templates';
var defaultContentTemplateDirname = '_default';
var partialTemplateDirname = '_partials';
var templateExtnames = [
  'njk'
];

var renderExtname = 'html';

var extnameFormatMap = {
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml'
};

/**
 *
 * @param  {String} file File basename, file basename with extension, or path
 * @param  {Array} dirs
 * @param  {Array} extnames
 * @return {String}
 */
function findFile(file, dirs, extnames) {
  var i, il, j, jl, dir, extname, str;

  if (file.substring(0, 1) === '/' || file.substring(0, 2) === './' || file.substring(0, 3) === '../') {
    if (fs.existsSync(file)) {
      return file;
    }

    for (i = 0, il = extnames.length; i < il; i++) {
      extname = extnames[i];
      str = file + extname;
      if (fs.existsSync(str)) {
        return str;
      }
    }

    return;
  }

  for (i = 0, il = dirs.length; i < il; i++) {
    dir = dirs[i];
    str = path.resolve(dir, file);
    if (fs.existsSync(str)) {
      return str;
    }
  }

  for (i = 0, il = dirs.length; i < il; i++) {
    dir = dirs[i];
    for (j = 0, jl = extnames.length; j < jl; j++) {
      extname = extnames[j];
      str = path.resolve(dir, file + extname);
      if (fs.existsSync(str)) {
        return str;
      }
    }
  }
}

/**
 *
 * @param  {Object} config Keys: src, dist, plugins, imageStyles, penrose, env
 * @return {Toco}
 */
function Toco(config) {
  this.config = config;

  this.flags = {
    initMdParser: false // Whether markdown parser has been initialised
  };

  // @todo Try to remove because unlikely to be used often
  nunjucksEnv.addFilter('kebabCase', function (value) {
    return _.kebabCase(value);
  });

  nunjucksEnv.addFilter('remove', function (html, selector) {
    var $ = cheerio.load(html);
    $(selector).remove();
    return $.html();
  });

  // Render given template with data. Similar to `include` tag.
  var RenderExtension = function () {
    this.tags = ['render'];

    this.parse = function (parser, nodes, lexer) {
      var tok = parser.nextToken();
      var args = parser.parseSignature(null, true);
      parser.advanceAfterBlockEnd(tok.value);

      var body = parser.parseUntilBlocks('end' + tok.value);
      parser.advanceAfterBlockEnd();

      return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = function (context, templateFile, ctx) {
      var body = _.last(arguments);
      var filter = (arguments[3] === body ? undefined : arguments[3]);

      templateFile = nunjucksEnv.findPartialTemplate(templateFile);

      var str = nunjucks.render(templateFile, _.isUndefined(filter) ? ctx : _.filter(ctx, filter));

      return new nunjucks.runtime.SafeString(str);
    };
  };

  nunjucksEnv.addExtension('render', new RenderExtension);
}

Toco.prototype = {
  constructor: Toco,
  /**
   * Initialises markdown parser.
   */
  initMdParser: function () {
    if (this.flags.initMdParser) {
      return;
    }

    var findPartialTemplate = function (templateName) {
      return this.findPartialTemplate(templateName);
    }.bind(this);

    var md = new Remarkable({
      html: true
    });

    md.config = this.config;

    // Required by nunjucks extensions.
    nunjucksEnv.findPartialTemplate = findPartialTemplate;

    // Required by remarkable plugins.
    md.findPartialTemplate = findPartialTemplate;

    // Required by remarkable plugins.
    md.penrose = new Penrose(this.config.penrose);

    // Required by nunjucks plugin.
    md.nunjucksEnv = nunjucksEnv;

    // Plugins.
    md.use(function (remarkable) {
      remarkable.renderer.rules.heading_open = function (tokens, idx) {
        return '<h' + tokens[idx].hLevel + ' id=' + toc.slugify(tokens[idx + 1].content) + '>';
      };
    });
    md.use(require('./remarkable/image'));
    md.use(require('./remarkable/note'));
    md.use(require('./remarkable/responsive_image'));
    md.use(require('./remarkable/template'));
    md.use(require('./remarkable/video'));

    this.md = md;

    this.flags.initMdParser = true;
  },
  /**
   * Returns HTML converted from given Markdown, and a list of post-processing tasks.
   *
   * @param  {String} markdown
   * @return {Object}
   */
  renderHtml: function (markdown) {
    this.initMdParser();

    var html = this.md.render(markdown);
    var tasks = {
      penrose: []
    };
    var $ = cheerio.load(html);

    // Extract penrose tasks.
    $('img[data-penrose-src]').each(function (i, elem) {
      var $elm = $(this);
      var src = $elm.data('penroseSrc');
      var styles = $elm.data('penroseStyles');

      if (src && styles) {
        tasks.penrose.push({
          src: src,
          styleNames: _.map(styles.split(','), function (value) {
            return _.trim(value);
          })
        });
      }

      $elm.removeAttr('data-penrose-src');
      $elm.removeAttr('data-penrose-styles');
    });

    var html = $.html();

    // Block math
    // http://docs.mathjax.org/en/latest/options/tex2jax.html#the-tex2jax-preprocessor
    // @todo Implement in Markdown parser (less error-prone)
    html = html.replace(/<pre>\s*<code>\s*(\$\$|\\\[)(.*)(\$\$|\\\])\s*<\/code>\s*<\/pre>/gim, '<div>$1$2$3</div>');

    // Inline math
    // http://docs.mathjax.org/en/latest/options/tex2jax.html#the-tex2jax-preprocessor
    // @todo Implement in Markdown parser (less error-prone)
    html = html.replace(/<code>\s*(\$|\\\()(.*)(\$|\\\))\s*<\/code>/gim, '$1$2$3');

    return {
      html: html,
      tasks: tasks
    };
  },
  /**
   * Returns table of contents converted from given Markdown.
   *
   * @param  {String} markdown
   * @param  {Object} options
   * @return {Object}
   */
  renderToc: function (markdown, options) {
    var nodes = [];

    function getParentNode(level, jsonTree) {
      var i = 0;
      var node = jsonTree[jsonTree.length - 1];

      while (i < level - 1) {
        var childNodes = node.childNodes;
        node = childNodes[childNodes.length - 1];
        i++;
      }

      if (!node.childNodes) {
        node.childNodes = [];
      }

      return node;
    }

    function Node(title, link) {
      this.title = title;
      this.link = link || '';
    }

    var items = toc(markdown, options).json;

    _.forEach(items, function (item) {
      var node = new Node(item.content, '#' + item.slug);

      if (item.lvl - 1 === 0) {
        nodes.push(node);
      }
      else {
        var p = getParentNode(item.lvl - 1, nodes);
        p.childNodes.push(node);
      }
    });

    return nodes;
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @return {String}
   */
  findTemplate: function (templateName) {
    var dirs = [
      './' + templateDirname + '/'
    ];

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, dirs, extnames);
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @return {String}
   */
  findPartialTemplate: function (templateName) {
    var dirs = [
      this.config.src + templateDirname + '/' + partialTemplateDirname + '/',
      './' + templateDirname + '/' + partialTemplateDirname + '/'
    ];

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, dirs, extnames);
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @param  {String} contentType
   * @return {String}
   */
  findContentTemplate: function (templateName, contentType) {
    var dirs;

    if (_.isUndefined(contentType)) {
      dirs = [
        this.config.src + templateDirname + '/' + defaultContentTemplateDirname + '/',
        './' + templateDirname + '/' + defaultContentTemplateDirname + '/'
      ];
    }
    else {
      dirs = [
        this.config.src + templateDirname + '/' + contentType + '/',
        './' + templateDirname + '/' + contentType + '/'
      ];
    }

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, dirs, extnames);
  },
  /**
   *
   * @param  {Array} src
   * @return {Promise}
   */
  loadFiles: function (src) {
    return multiGlob(src)
      .then(function (matched) {
        var files = [];

        _.forEach(matched, function (file) {
          files.push({
            path: file
          });
        });

        return Promise.mapSeries(files, function (file) {
          file.data = fs.readFileAsync(file.path, 'utf8');

          return Promise.props(file);
        });
      });
  },
  /**
   * Loads site data.
   *
   * @param  {Array} src
   * @return {Promise}
   */
  loadData: function (src) {
    return this.loadFiles(src)
      .then(function (files) {
        var data = {};

        _.forEach(files, function (file) {
          var extname = path.extname(file.path);
          var basename = path.basename(file.path, extname);
          extname = _.trim(extname, '.').toLowerCase();
          var format = extnameFormatMap[extname];

          if (format === 'json') {
            data[basename] = JSON.parse(file.data);
          }
          else if (format === 'yaml') {
            data[basename] = yaml.safeLoad(file.data);
          }
        });

        return Promise.resolve(data);
      });
  },
  /**
   *
   * @return {Promise}
   */
  build: function () {
    var self = this;
    var config = this.config;
    var penrose = new Penrose(this.config.penrose);
    var dataSrc = _.map(dataExtnames, function (extname) {
      return path.resolve(config.src, dataDirname, '**', '*.' + extname);
    });
    var contentSrc = _.map(contentExtnames, function (extname) {
      return path.resolve(config.src, contentDirname, '**', '*.' + extname);
    });
    var contentPathAbs = path.resolve(config.src, contentDirname);

    // Load site data.
    return this.loadData(dataSrc)
      .then(function (data) {
        var site = {
          data: data
        };

        nunjucksEnv.addGlobal('site', site);

        // Load markdown source files.
        return self.loadFiles(contentSrc);
      })
      .then(function (files) {
        // Extract front matter and content, and convert markdown to HTML.
        return Promise.mapSeries(files, function (file) {
          var splitText = file.data.toString().split(/\n\n/);
          var meta = yaml.safeLoad(_.trim(splitText[0], '\n-')) || {};
          var markdown = splitText.splice(1, splitText.length - 1).join('\n\n');

          var relPath = _.trim(file.path.substring(contentPathAbs.length), '/');

          // If content type is not given in front matter, then infer from path.
          if (_.isUndefined(meta.type)) {
            var dirname = path.dirname(relPath);
            var firstSegment = dirname.split('/')[0];

            if (firstSegment.length && firstSegment !== '.' && firstSegment !== '..') {
              meta.type = firstSegment;
            }
          }

          var result = self.renderHtml(markdown);

          var lead = _.get(meta, 'lead');
          var leadHtml = '';
          if (!_.isUndefined(lead)) {
            leadHtml = self.renderHtml(lead).html;
          }

          var tocFile = self.findPartialTemplate('toc');
          var tocHtml = nunjucks.render(tocFile, {
            nodes: self.renderToc(markdown)
          });

          file.relPath = relPath;
          file.meta = meta;
          file.html = result.html;
          file.tasks = result.tasks;
          file.leadHtml = leadHtml;
          file.tocHtml = tocHtml;

          return Promise.props(file);
        });
      })
      .then(function (files) {
        // Run penrose tasks.
        var tasks = [];

        _.forEach(files, function (file) {
          _.forEach(file.tasks.penrose, function (task) {
            _.forEach(task.styleNames, function (styleName) {
              var style = config.imageStyles[styleName];

              tasks.push({
                style: style,
                src: task.src,
                dist: penrose.getDerivativePath(styleName, task.src, config.penrose.srcBase)
              });
            });
          });
        });

        return Promise.mapSeries(tasks, function (task) {
            return penrose.createDerivative(task.style, task.src, task.dist);
          })
          .then(function () {
            return Promise.resolve(files);
          });
      })
      .then(function (files) {
        // Build list of files to write.
        var writeFiles = [];

        // Build sitemap.
        var sitemap = [];

        _.forEach(files, function (file) {
          var extname = path.extname(file.relPath);
          var basename = path.basename(file.relPath, extname);
          var dirname = path.dirname(file.relPath);

          file.absPath = path.resolve(config.dist, dirname, basename + '.' + renderExtname);
          file.urlPath = '/' + path.relative(path.resolve(config.dist, '..'), file.absPath);

          sitemap.push({
            path: file.urlPath,
            title: _.get(file.meta, 'title')
          });
        });

        _.forEach(files, function (file) {
          var templateName = 'single';
          var templateFile = self.findContentTemplate(templateName, file.meta.type);

          writeFiles.push({
            path: file.absPath,
            data: nunjucks.render(templateFile, {
              env: config.env || {},
              // http://toolchain.gitbook.com/plugins/api.html#page-instance
              page: {
                path: file.urlPath,
                title: _.get(file.meta, 'title'),
                lead: file.leadHtml,
                content: file.html,
                toc: file.tocHtml
              },
              sitemap: sitemap
            })
          });
        });

        // Write to files.
        return Promise.mapSeries(writeFiles, function (file) {
          var dirname = path.dirname(file.path);

          return mkdirpAsync(dirname)
            .then(function () {
              return fs.writeFileAsync(file.path, file.data, 'utf8');
            });
        });
      });
  }
};

module.exports = {
  Toco: Toco
};
