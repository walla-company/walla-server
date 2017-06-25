// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

var minversion = {};

const minVersion = databaseref.child('app_settings/min_version');
minVersion.on('value', snapshot => minversion = snapshot.val());

app.get('/api/min_version', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.read && !authentication.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    var platform = req.query.platform.toLowerCase();

    tokenManager.incrementTokenCalls(token);

    switch (platform) {
        case 'android':
            res.status(result.requestsuccessful).send(
                { 'min_version': minversion.android }
            );
            break;
        case 'ios':
            res.status(result.requestsuccessful).send(
                { 'min_version': minversion.ios }
            );
            break;
        default:
            res.status(result.requestbad).send(result.invalidparams)
            return;
    }

});
