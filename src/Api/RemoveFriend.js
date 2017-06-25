// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/remove_friend', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.body.school_identifier;
    var uid = req.body.uid;
    var friend = req.body.friend;

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    if(!friend){
        res.status(result.requestbad).send('invalid parameters: no friend');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/friends/' + friend).remove();
    databaseref.child('schools/' + school_identifier + '/users/' + friend + '/friends/' + uid).remove();

    res.status(result.requestsuccessful).send('friend removed');

});
