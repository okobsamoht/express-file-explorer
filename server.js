var express = require('express');
var fileExplorer = require('./index');

var app = express();

var dir = process.argv[2] || '.';
app.use(fileExplorer(dir));

var port = 9006, ip = null;
app.listen(port, ip, function (error) {
    if (error) throw error;
    console.log('Listening on ' + (ip || '') + ':' + port);
})
