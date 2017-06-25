// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_sent_friend_requests', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.read){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/sent_friend_requests/').once('value').then(function(snapshot){
            if(snapshot.val())
                res.status(result.requestsuccessful).send(snapshot.val());
            else
                res.status(result.requestsuccessful).send({});
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });

});
