// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');

app.post('/api/flag_activity', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.body['school_identifier'];
    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    var auid = req.body['auid'];
    if(!auid){
        res.status(result.requestbad).send('invalid parameters: no event key');
        return;
    }

    var uid = req.body['uid'];
    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }
  
    databaseref.child('schools').child(school_identifier).child('flagged_activities').child(auid).child(uid).set(new Date().getTime() / 1000);
    
    res.status(result.requestsuccessful).send('activity flagged');
});
