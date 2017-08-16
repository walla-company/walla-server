// @flow

const databaseref = require('../shared/Firebase');
const TokenGenerator = require( 'token-generator' )({
        salt: 'haldiuvblaue9ufai3br8uya9-hv84irqe8ty',
        timestampMap: 'N72md4XaF8',
});

function incrementTokenCalls(token) {
    databaseref.child('app_settings/api_keys/' + token)
        .child('calls')
        .transaction(function (snapshot) {
        snapshot++;
        return snapshot;
    });
}

module.exports = {
    incrementTokenCalls,
    TokenGenerator,
}