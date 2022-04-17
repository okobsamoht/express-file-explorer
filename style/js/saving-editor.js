function savingEditor(elements, savedValue, mode, saveFunction) {
    var softTabs = false;
    var tabSize = 4;
    savedValue.split('\n').forEach(function (line) {
        var ws = line.replace(/[^\s].*/, '');
        if (!ws) return;
        if (ws[0] != '\t') {
            softTabs = true;
        }
        var spaceIndent = '';
        while (spaceIndent.length < tabSize) spaceIndent += ' ';
        ws = ws.replace(/[^ ]/g, spaceIndent);
        tabSize = Math.min(tabSize, ws.length);
    });

    for (var key in elements) {
        if (typeof elements[key] === 'string') {
            elements[key] = document.getElementById(elements[key]);
        }
    }

    var queuedSave = null;
    var pendingSave = null;
    var savingError = null;
    function save(value, callback) {
        if (pendingSave !== null) {
            if (queuedSave !== pendingSave) {
                queuedSave = value;
            }
            return;
        }
        if (value === savedValue) {
            return
        }

        pendingSave = value;
        updateButton();
        saveFunction(value, function (error) {
            savingError = error;
            if (!error) {
                savedValue = pendingSave;
            } else {
                savedValue = null; // not equal to any string, so always force resave
            }
            pendingSave = null;

            if (queuedSave !== null) {
                save(queuedSave, callback);
                queuedSave = null;
            } else if (callback) {
                callback(error);
            }
            updateButton();
        });
    }

    function canExit() {
        return (pendingSave === null) && !canSave(editor.getValue());
    }
    function canSave(value) {
        if (queuedSave !== null) {
            return queuedSave !== value;
        }
        if (pendingSave !== null) {
            return pendingSave !== value;
        }
        return savedValue !== value;
    }
    function updateButton() {
        var changed = canSave(editor.getValue());
        if (elements.button) {
            elements.button.disabled = !changed;
        }
        if (savingError) {
            setStatus('<span class="error">Error saving: ' + (savingError.message || '(unknown)').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>');
        } else if (changed) {
            setStatus('changed');
        } else if (pendingSave !== null) {
            setStatus('saving');
        } else {
            setStatus('');
        }
    }
    function setStatus(html) {
        if (!elements.status) return;
        if (typeof html === 'string') {
            elements.status.innerHTML = html;
        } else {
            elements.status.innerHTML = '';
            elements.status.appendChild(html);
        }
    }

    var editor = ace.edit(elements.main);
    editor.setTheme("ace/theme/dawn");
    var session = editor.getSession();
    session.setMode("ace/mode/" + mode);
    session.setUseSoftTabs(softTabs);
    session.setTabSize(tabSize);

    editor.on('change', updateButton);

    editor.commands.addCommand({
        name: 'saveFile',
        bindKey: {
            win: 'Ctrl-S',
            mac: 'Command-S',
            sender: 'editor|cli'
        },
        exec: function(env, args, request) {
            save(editor.getValue());
        }
    });
    if (elements.button) {
        elements.button.onclick = function () {
            save(editor.getValue());
        };
    }
    editor.setValue(savedValue, -1);
    updateButton();
    return {
        editor: editor,
        destroy: function () {
            editor.destroy();
            if (editor.main.parentNode) {
                editor.main.parentNode.removeChild(editor.main);
            }
        },
        save: function (callback) {
            return save(editor.getValue(), callback);
        },
        canExit: function () {
            return canExit();
        }
    };
}
