'use strict';

var ipc = require('electron').ipcRenderer;

function login(username, password) {
    ipc.send('user-credential', {
        ok: true,
        username: username,
        password: password
    });
    setTimeout(function() {
        window.close();
    }, 500);
};

function cancel() {
    ipc.send('user-credential', {
        ok: false
    });
    setTimeout(function() {
        window.close();
    }, 500);
};