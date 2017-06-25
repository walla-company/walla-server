// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/interested', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin && !authentication.write) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    const uid = req.body['uid'];
    const school_identifier = req.body['school_identifier'];
    const auid = req.body['auid'];

    if (!uid) {
        res.status(result.requestbad).send(result.invalidparams + ' no uid');
        return;
    }

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    if (!auid) {
        res.status(result.requestbad).send(result.invalidparams + ' no auid');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/replies/' + uid).set("interested");

    var currentTime = new Date().getTime() / 1000;
    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar/' + auid).set(currentTime);

    res.status(result.requestsuccessful).send('Interested changed');

});
