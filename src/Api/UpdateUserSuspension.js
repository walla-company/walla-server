// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const webHelpers = require('../shared/WebConsoleHelpers');

app.post('/api/update_user_suspension', (req, res) => {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    const school_identifier = req.body['school_identifier'];
    const uid = req.body['uid'];
    const suspended = req.body['suspended'];
    console.log(school_identifier, uid, suspended);

    webHelpers.changeUserSuspension(school_identifier, uid, suspended)
        .then(() => res.sendStatus(result.requestsuccessful));
    
});