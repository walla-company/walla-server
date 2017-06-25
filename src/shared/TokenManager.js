// @flow

const databaseref = require('../shared/Firebase');

function incrementTokenCalls(token) {
    databaseref.child('app_settings/api_keys/' + token)
        .child('calls')
        .transaction(function (snapshot) {
        snapshot++;
        return snapshot;
    });
}

module.exports = {
    'incrementTokenCalls': incrementTokenCalls,
}