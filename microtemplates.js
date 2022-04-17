function template(string, options) {
	var defaults = template.options || {};
	options = options || {};
	var start = options.start || defaults.start;
	var end = options.end || defaults.end;
	var shortFunctions = Object.create(options.short || {});
	for (var key in defaults.short) {
		shortFunctions[key] = shortFunctions[key] || defaults.short[key];
	}
	var longest = 1;
	for (var key in shortFunctions) {
		longest = Math.max(longest, key.length);
	}

	var parts = string.split(start);
	var code = ['_p[0]=' + JSON.stringify(parts.shift()) + ';'];
	code.push('function print(){for(var i=0;i<arguments.length;i++)_p.push(arguments[i])}');
	while (parts.length) {
		var part = parts.shift();
		var templateCode = part.split(end, 1)[0];
		var remainder = part.substring(templateCode.length).replace(end, '');
		var shortKey = null;
		for (var i = longest; !shortKey && i > 0; i--) {
			if (shortFunctions[templateCode.substring(0, i)]) {
				shortKey = templateCode.substring(0, i);
			}
		}
		if (shortKey) {
			code.push('_p.push(_s[' + JSON.stringify(shortKey) + '](' + templateCode.substring(shortKey.length) + '));');
		} else {
			code.push(templateCode);
		}
		if (remainder) {
			code.push('_p.push(' + JSON.stringify(remainder) + ');');
		}
	}
	var indented = '\t\t' + code.join('\n').replace(/\n/g, '\n\t\t');
	var metaCode = 'return function (_data) {\n\tvar _p=[];\n\twith(_data){\n' + indented + '\n\t};\n\treturn _p.join("");\n}';
	var debugCode = metaCode.replace(/^return /, '').split('\n').map(function (line, index) {
		index = (index + 2) + ""; // One because it's 1-indexed, one because it was wrapped in another function
		while (index.length < 3) index = " " + index;
		return index + ': ' + line;
	}).join('\n');
	try {
		var metaFunc = new Function('_s', metaCode);
	} catch (e) {
		console.log(debugCode);
		throw e;
	}
	var result = metaFunc(shortFunctions);
	result.toString = function () {
		return debugCode;
	};
	return result;
}

template.options = {
	start: '<%',
	end: '%>',
	short: {
		'=': function htmlEscape(str) {
			return (str + "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		},
		'!': function rawHtml(str) {
			return (str + "");
		}
	}
};

module.exports = template;
