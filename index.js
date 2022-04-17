var fs = require('fs'), path = require('path');
var async = require('async');
var mime = require('mime');
var express = require('express');

var microTemplates = require('./microtemplates');
microTemplates.options.short[':'] = function (data) {
    return JSON.stringify(data).replace(/<\//g, '<\\/'); // avoid close-script tags
};
var templates = {};
var templateDir = path.join(__dirname, 'templates');
['directory', 'preview', 'text'].forEach(function (key) {
    var templateString = fs.readFileSync(path.join(templateDir, key + '.html'), {encoding: 'utf-8'});
	templates[key] = microTemplates(templateString);
});

module.exports = function (browseDir, options) {
	var app = express();
	app.use('/style', express.static(path.join(__dirname, 'style')));

    browseDir = browseDir || '.';
	options = options || {};
    options.hideDot = (options.hideDot !== false);
	options.textExtensions = [].concat(options.textExtensions || [
		'gitignore'
	]);
	options.textTypes = [].concat(options.textTypes || [
		/^[^/]+\/([^/]+\+)*json($|;|\s)/i,
		/^[^/]+\/([^/]+\+)*xml($|;|\s)/i,
		/^[^/]+\/([^/]+\+)*javascript($|;|\s)/i,
		/^charset="?utf-8"?/i
	]);

    app.get('/', function (request, response, next) {
        response.redirect(request.baseUrl + '/browse');
    });

    app.use('/raw', function (request, response, next) {
        var unescapedPath = request.path.split('/').map(function (part) {
            return decodeURIComponent(part).replace(/\//g, '\\/');
        }).join('/');
		var relativePath = path.join('/', unescapedPath || '/');
		var fullPath = path.join(browseDir, relativePath);
        if (!path.isAbsolute(fullPath)) {
            fullPath = path.join(process.cwd(), fullPath);
        }

        if (request.method === 'PUT') {
            var stream = fs.createWriteStream(fullPath);
            request.pipe(stream);
            stream.on('error', function (error) {
                return next(error);
            });
            stream.on('close', function () {
                response.json(true);
            });
        } else if (request.method === 'GET') {
            response.sendFile(fullPath);
        } else {
            next();
        }
    });

    app.use(['/preview', '/text'], function (request, response, next) {
        if (request.method !== 'GET') return next();
        var baseUrl = (request.baseUrl || '').replace(/\/(preview|text)$/, '');
        var stylePath = baseUrl + '/style';

        function urlForPath(path) {
            path = path.split('/').map(function (part) {
                return encodeURIComponent(part.replace(/\\\//g, '/'));
            }).join('/');
            return baseUrl + '/browse' + path;
        }
        function rawUrlForPath(path, type) {
            path = path.split('/').map(function (part) {
                return encodeURIComponent(part.replace(/\\\//g, '/'));
            }).join('/');
            return baseUrl + '/raw' + path + (type ? '?as=' + encodeURIComponent(type) : '');
        }

        var rawUrl = baseUrl + '/' + request.path;
        var unescapedPath = request.path.split('/').map(function (part) {
            return decodeURIComponent(part).replace(/\//g, '\\/');
        }).join('/');
		var relativePath = path.join('/', unescapedPath || '/');
		var fullPath = path.join(browseDir, relativePath);

        if (/\/text$/.test(request.baseUrl)) {
            request.query.as = request.query.as || 'text/plain';
        } else {
            request.query.as = request.query.as;
        }
        var data = {
            mimeType: request.query.as,
            mimeGuess: mime.lookup(fullPath),
            name: path.basename(fullPath),
            path: relativePath,
            rawUrl: rawUrlForPath(relativePath, request.query.as),
            parent: relativePath.replace(/\/[^/]*$/, '') || '/'
        };
        data.parentUrl = urlForPath(data.parent);

        if (/\/text$/.test(request.baseUrl)) {
            fs.readFile(fullPath, {encoding: 'utf-8'}, function (error, text) {
                if (error) return next(error);
                response.send(templates.text({
                    file: data,
                    style: stylePath,
                    text: text
                }));
            })
        } else {
            response.send(templates.preview({
                file: data,
                style: stylePath
            }));
        }
    });

	app.use('/browse', function (request, response, next) {
        if (request.method !== 'GET') return next();

        var baseUrl = (request.baseUrl || '');
        var stylePath = baseUrl.replace(/\/browse\/?$/, '/style');
        function urlForPath(path) {
            path = path.split('/').map(function (part) {
                return encodeURIComponent(part.replace(/\\\//g, '/'));
            }).join('/');
            return baseUrl + path;
        }
        function previewUrlForPath(path) {
            path = path.split('/').map(function (part) {
                return encodeURIComponent(part.replace(/\\\//g, '/'));
            }).join('/');
            return baseUrl.replace(/\/browse\/?/, '/preview') + path;
        }
        function textUrlForPath(path) {
            path = path.split('/').map(function (part) {
                return encodeURIComponent(part.replace(/\\\//g, '/'));
            }).join('/');
            return baseUrl.replace(/\/browse\/?/, '/text') + path;
        }
        function rawUrlForPath(path) {
            path = path.split('/').map(function (part) {
                return encodeURIComponent(part.replace(/\\\//g, '/'));
            }).join('/');
            return baseUrl.replace(/\/browse\/?/, '/raw') + path;
        }

        var unescapedPath = request.path.split('/').map(function (part) {
            return decodeURIComponent(part).replace(/\//g, '\\/');
        }).join('/');
		var relativePath = path.join('/', unescapedPath || '/');
		var fullPath = path.join(browseDir, relativePath);
		fs.stat(fullPath, function (error, stats) {
			if (error) return next(error);
			if (stats.isDirectory()) {
				fs.readdir(fullPath, function (error, entries) {
					entries = entries.filter(function (a) {
						if (a === '.' || a === '..') return false;
                        if ((options.hideDot && !request.query.hidden) && a[0] === '.') return false;
                        return true;
					});
					async.map(entries, function (entry, callback) {
						var relativeEntry = path.join(relativePath, entry);
						var fullEntry = path.join(fullPath, entry);
						var extension = entry.replace(/.*\./, '');
						fs.stat(fullEntry, function (error, stats) {
							var mimeType = null, mimeCategory = null, mimeSubType = null;
							if (!stats.isDirectory()) {
								mimeType = mime.lookup(relativeEntry);
								mimeCategory = mimeType.replace(/\/.*/, '');
								mimeSubType = mimeType.replace(/.*\//, '').replace(/(;|\s).*/, '');
								if (options.textExtensions.indexOf(extension.toLowerCase()) !== -1) {
									mimeCategory = 'text';
								}
								for (var i = 0; i < options.textTypes.length; i++) {
									var type = options.textTypes[i];
									if (typeof type === 'string' && mimeType.substring(0, type.length) === type) {
										mimeCategory = 'text';
									} else if (type.test && type.test(mimeType)) {
										mimeCategory = 'text';
									}
								}
							}
							if (error) callback(error);
                            var jsonData = {
								name: entry,
								path: relativeEntry,
								mimeType: mimeType,
								mimeCategory: mimeCategory || 'directory',
								mimeSubType: mimeSubType || 'directory',
								type: stats.isDirectory() ? 'directory' : 'file',
								size: stats.size,
								modified: stats.mtime.getTime()/1000,
								created: stats.ctime.getTime()/1000,
								mode: stats.mode
							};
                            jsonData.rawUrl = rawUrlForPath(relativeEntry);
                            if (jsonData.type === 'directory') {
                                jsonData.url = urlForPath(relativeEntry);
                            } else if (jsonData.mimeCategory === 'text') {
                                jsonData.url = textUrlForPath(relativeEntry) + '?as=' + encodeURIComponent(jsonData.mimeType);
                            } else if (jsonData.mimeCategory === 'image') {
                                jsonData.url = previewUrlForPath(relativeEntry);
                            } else {
                                jsonData.url = rawUrlForPath(relativeEntry);
                            }
							callback(null, jsonData);
						});
					}, function (error, dirListing) {
						if (error) return next(error);
						dirListing.sort(function (a, b) {
							if (a.type < b.type) return -1;
							if (a.type > b.type) return 1;
							return (a.name.toLowerCase() < b.name.toLowerCase()) ? -1 : 1;
						})
						var dirData = {
							path: relativePath,
							name: path.basename(relativePath) || 'root',
							children: dirListing,
                            rawUrl: rawUrlForPath(relativePath)
						};
                        var parent = relativePath.replace(/\/[^/]*$/, '') || '/';
						dirData.parent = parent;
						dirData.parentUrl = (relativePath !== '/' || null) && urlForPath(parent);
						response.send(templates.directory({
							directory: dirData,
							style:stylePath
						}));
					});
				});
			} else {
				response.json(stats);
			}
		});
	});

	return app;
};
