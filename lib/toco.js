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
var yamlFrontMatter = require('yaml-front-matter');

Promise.promisifyAll(fs);

fs.existsAsync = Promise.promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists);
  });
});

var mkdirpAsync = Promise.promisify(mkdirp);

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

var themesDirname = 'themes';
var templatesDirname = 'templates';
var partialsDirname = '_partials';
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
 * @param  {Object} config
 * @return {Toco}
 */
function Toco(config) {
  this.config = _.assign({}, {
    distURL: '',
    nunjucks: {
      filters: {}
    },
    remarkable: {
      plugins: {}
    },
    themes: [] // @todo Use more appropriate/descriptive name than `themes`
  }, config);

  var findPartialTemplate = function (templateName) {
    return this.findPartialTemplate(templateName);
  }.bind(this);

  var templateDirs = [];

  if (_.isUndefined(this.config.templateDirs)) {
    templateDirs = templateDirs.concat([
      path.resolve(this.config.src, themesDirname),
      path.resolve(this.config.src, templatesDirname)
    ]);
  }
  else {
    templateDirs = templateDirs.concat(this.config.templateDirs);
  }

  templateDirs.push(path.resolve(__dirname, '..', templatesDirname));

  var nunjucksEnv = nunjucks.configure(templateDirs);

  _.forEach(this.config.nunjucks.filters, function (filter, filterName) {
    nunjucksEnv.addFilter(filterName, filter);
  });

  nunjucksEnv.addFilter('markdown', function (data, selector) {
    var md = new Remarkable({
      html: true
    });
    return md.render(data);
  });

  nunjucksEnv.addFilter('remove', function (data, selector) {
    var $ = cheerio.load(data);
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

      templateFile = findPartialTemplate(templateFile);

      var data;

      if (_.isUndefined(filter)) {
        data = ctx;
      }
      else {
        data = _.filter(ctx, filter);
      }

      if (!_.isPlainObject(data)) {
        data = {
          data: data
        };
      }

      var str = nunjucks.render(templateFile, data);

      return new nunjucks.runtime.SafeString(str);
    };
  };

  nunjucksEnv.addExtension('render', new RenderExtension);

  nunjucksEnv.addGlobal('getJSON', function (src) {
    if (!fs.existsSync(src)) {
      return;
    }

    var str = fs.readFileSync(src, 'utf8');

    return JSON.parse(str);
  });

  nunjucksEnv.addGlobal('getYAML', function (src) {
    if (!fs.existsSync(src)) {
      return;
    }

    var str = fs.readFileSync(src, 'utf8');

    return yaml.safeLoad(str);
  });

  var md = new Remarkable({
    html: true
  });

  md.config = this.config;
  md.findPartialTemplate = findPartialTemplate;
  md.penrose = new Penrose(this.config.penrose);
  md.nunjucksEnv = nunjucksEnv;

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
  this.nunjucksEnv = nunjucksEnv;
}

Toco.prototype = {
  constructor: Toco,
  /**
   * Returns HTML converted from given Markdown, and a list of post-processing tasks.
   *
   * @param  {String} markdown
   * @return {Object}
   */
  renderHtml: function (markdown) {
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

    html = $.html();

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

      if (!node) {
        return;
      }

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
        var parentNode = getParentNode(item.lvl - 1, nodes);

        if (parentNode) {
          parentNode.childNodes.push(node);
        }
      }
    });

    return nodes;
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @param  {String} contentType
   * @param  {String} themeName
   * @return {String}
   */
  findContentTemplate: function (templateName, contentType, themeName) {
    var templateDirs = [];

    // If theme and content type given.
    if (!_.isUndefined(themeName) && !_.isUndefined(contentType)) {
      templateDirs = templateDirs.concat([
        path.resolve(this.config.src, themesDirname, themeName, templatesDirname, contentType) + '/',
        path.resolve(this.config.src, themesDirname, themeName, templatesDirname) + '/',
        path.resolve(this.config.src, templatesDirname, contentType) + '/',
        path.resolve(__dirname, '..', templatesDirname, contentType) + '/'
      ]);
    }
    // If theme given.
    else if (!_.isUndefined(themeName)) {
      templateDirs = templateDirs.concat([
        path.resolve(this.config.src, themesDirname, themeName, templatesDirname) + '/'
      ]);
    }
    // If content type given.
    else if (!_.isUndefined(contentType)) {
      templateDirs = templateDirs.concat([
        path.resolve(this.config.src, templatesDirname, contentType) + '/',
        path.resolve(__dirname, '..', templatesDirname, contentType) + '/'
      ]);
    }

    templateDirs = templateDirs.concat([
      path.resolve(this.config.src, templatesDirname) + '/',
      path.resolve(__dirname, '..', templatesDirname) + '/'
    ]);

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, templateDirs, extnames);
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @return {String}
   */
  findPartialTemplate: function (templateName) {
    var templateDirs = [
      path.resolve(this.config.src, templatesDirname, partialsDirname) + '/',
      path.resolve(__dirname, '..', templatesDirname, partialsDirname) + '/'
    ];

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, templateDirs, extnames);
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
   * @param  {Object} filter
   * @return {Promise}
   */
  build: function (filter) {
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

        self.nunjucksEnv.addGlobal('site', site);

        // Load markdown source files.
        return self.loadFiles(contentSrc);
      })
      .then(function (files) {
        // Extract front matter and content.
        return Promise.mapSeries(files, function (file) {
          var fm = yamlFrontMatter.loadFront(file.data);
          var meta = _.pick(fm, _.difference(_.keys(fm), ['__content']))
          var content = fm.__content;

          var relPath = _.trim(file.path.substring(contentPathAbs.length), '/');

          // If themes is not given in front matter, then infer from filename and config.
          if (_.isUndefined(meta.themes)) {
            var extname = path.extname(relPath);
            var basename = path.basename(relPath, extname);
            var modifier = basename.split('--')[1];

            if (!_.isUndefined(modifier)) {
              meta.themes = [modifier];
            }
            else {
              meta.themes = config.themes;
            }
          }

          // If content type is not given in front matter, then infer from path.
          if (_.isUndefined(meta.type)) {
            var dirname = path.dirname(relPath);
            var firstSegment = dirname.split('/')[0];

            if (firstSegment.length && firstSegment !== '.' && firstSegment !== '..') {
              meta.type = firstSegment;
            }
          }

          if (_.isUndefined(meta.template)) {
            // if (_.isUndefined(meta.type)) {
            //   var extname = path.extname(relPath);
            //   var basename = path.basename(relPath, extname);
            //
            //   meta.template = basename;
            // }
            // else {
            //   meta.template = 'single';
            // }
            meta.template = 'single';
          }

          file.relPath = relPath;
          file.meta = meta;
          file.content = content;

          return Promise.props(file);
        });
      })
      .then(function (files) {
        if (!_.isUndefined(filter)) {
          // Filter by themes
          if (_.isArray(filter.themes) && filter.themes.length) {
            files = _.filter(files, function (file) {
              return _.isArray(file.meta.themes) && file.meta.themes.length && _.intersection(filter.themes, file.meta.themes).length;
            });
          }
        }

        return Promise.resolve(files);
      })
      .then(function (files) {
        // Convert markdown to HTML
        return Promise.mapSeries(files, function (file) {
          var result = self.renderHtml(file.content);

          var lead = _.get(file.meta, 'lead');
          var leadHtml = '';
          if (!_.isUndefined(lead)) {
            leadHtml = self.renderHtml(lead).html;
          }

          var tocTemplateName = 'toc';
          var tocTemplateFile = self.findPartialTemplate(tocTemplateName);

          if (_.isUndefined(tocTemplateFile)) {
            throw new Error('Partial template not found: ' + tocTemplateName);
          }

          var tocHtml = nunjucks.render(tocTemplateFile, {
            nodes: self.renderToc(file.content)
          });

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
                dist: penrose.getStylePath(styleName, task.src)
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
          file.urlPath = config.distURL + path.relative(path.resolve(config.dist), file.absPath);

          sitemap.push({
            path: file.urlPath,
            title: _.get(file.meta, 'title')
          });
        });

        _.forEach(files, function (file) {
          var templateFile = self.findContentTemplate(file.meta.template, file.meta.type, file.meta.theme);

          if (_.isUndefined(templateFile)) {
            throw new Error('Content template not found: ' + file.meta.template + ', ' + file.meta.type + ', ' + file.meta.theme);
          }

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
