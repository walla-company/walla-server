// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/going', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin && !auth.write) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var uid = req.body['uid'];
    var school_identifier = req.body['school_identifier'];
    var auid = req.body['auid'];

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

    const activityRef = databaseref.child('schools/' + school_identifier + '/activities/' + auid);

    activityRef.child('host').once('value').then(snapshot => {
        const host = snapshot.val();

        activityRef.child('replies/' + uid).set("going");

        var currentTime = new Date().getTime() / 1000;
        databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar/' + auid).set(currentTime);

        pointsManager.addPointsToUser('AttendToActivity', school_identifier, uid, 1, 'User is attending to activity ID ' + auid, auid);
        pointsManager.addPointsToUser('ActivityAttended', school_identifier, host, 1, 'User\'s activity ID ' + auid + ' was attended by someone', auid);

        res.status(result.requestsuccessful).send('Going changed');
    });

});
