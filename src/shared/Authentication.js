// @flow
const databaseref = require('./Firebase');

const read = 1;
const write = 2;
const del = 4;
const admin = 8;
const verify = 16;

var readList = [];
var writeList = [];
var deleteList = [];
var adminList = [];
var verifyList = [];

const keys = databaseref.child('app_settings/api_keys');
keys.on('value', snapshot => {
    var auth = snapshot.val();

    console.log('auth: ' + auth);

    readList = [];
    writeList = [];
    deleteList = [];
    adminList = [];
    verifyList = [];

    var key;
    for (key in auth) {
        if (auth[key].auth & read) {
            readList.push(key)
        };

        if (auth[key].auth & write) {
            writeList.push(key)
        };

        if (auth[key].auth & del) {
            deleteList.push(key)
        };

        if (auth[key].auth & admin) {
            adminList.push(key)
        };

        if (auth[key].auth & verify) {
            verifyList.push(key)
        };
    }
});

function permissions(token) {
    var auth;

    if (!token) {
        auth = 0;
    } else {
        auth = getAuthLevel(token);
    }

    return {
        'read': auth & read,
        'write': auth & write,
        'delete': auth & del,
        'admin': auth & admin,
        'verify': auth & verify
    };
}

function getAuthLevel(token) {
    var auth = 0;
    if (readList.indexOf(token) >= 0) {
        auth = auth | read;
    }

    if (writeList.indexOf(token) >= 0) {
        auth = auth | write;
    }

    if (deleteList.indexOf(token) >= 0) {
        auth = auth | del;
    }

    if (adminList.indexOf(token) >= 0) {
        auth = auth | admin;
    }

    if (verifyList.indexOf(token) >= 0) {
        auth = auth | verify;
    }

    return auth;
}

module.exports = {
    'permissions': permissions,
    'read': read,
    'write': write,
    'del': del,
    'admin': admin,
    'verify': verify,
};
