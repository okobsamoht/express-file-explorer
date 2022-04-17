function pageDrop(options) {
    options = (typeof options === 'object') ? (options || {}) : {url: options};

    var method = options.method || 'PUT';
    var urlForName = (typeof options.url === 'function') ? options.url : function () {
        return options.url;
    };

    var pendingSend = false;
    function send(file, callback) {
        pendingSend = true;
        var url = urlForName(file.name);
        var r = new XMLHttpRequest();
        r.open(method, url, true);
        r.onreadystatechange = function () {
            if (r.readyState !== 4) return;
            pendingSend = false;
            if (r.status < 200 || r.status >= 300) {
                callback(new Error(r.status + ' ' + r.statusText + ': ' + url));
            } else {
                callback(null);
            }
        };
        r.upload.onprogress = function (event) {
               var ratio = event.loaded/event.total;
               var name = file.name;
               if (name.length > 20) {
                      name = name.substring(0, 17) + '...';
               }
               document.querySelector('#status').innerHTML = name + ': ' + Math.floor(ratio*1000)/10 + "%";
       };
        r.setRequestHeader('Content-Type', file.type);
        r.send(file);
    }

    function sendMultiple(files, callback) {
        if (!files.length) {
            return setTimeout(callback.bind(null, null));
        }
        send(files[0], function (error) {
            if (error) return callback(error);
            sendMultiple(files.slice(1), callback);
        });
    }

    document.body.addEventListener('dragover', function (event) {
        event.preventDefault();
    }, false);
    document.body.addEventListener('drop', getFiles, false);
    function getFiles(event) {
        if (pendingSend) {
            return alert('Wait until existing upload has finished');
        }
        event.preventDefault();
        var files = [];
        for (var i = 0; i < event.dataTransfer.files.length; i++) {
            files.push(event.dataTransfer.files[i]);
        }
        sendMultiple(files, function (error) {
            if (error) alert(error.message);
            if (!pendingSend) {
                location.reload();
            }
        });
    }
}
