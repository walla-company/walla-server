// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/update_user_interests', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
        res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.body['school_identifier'];
    var uid = req.body['uid'];
    var interests = req.body['interests'];

    if(!uid){
        res.status(result.requestbad).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(result.requestbad).send("invalid parameters: no school identifier");
        return;
    }

    if(!interests){
        res.status(result.requestbad).send("invalid parameters: no interests");
        return;
    }

    databaseref.child('schools').child(school_identifier).child('users').child(uid).child('interests').set(interests);

    pointsManager.addProfileCompletionPointsToUser(school_identifier, uid);

    res.status(result.requestsuccessful).send("interests updated");

});
