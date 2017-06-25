// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/update_notification_read', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.body.school_identifier;
    var notification_id = req.body.notification_id;
    var uid = req.body.uid;
    var read = req.body.read;

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    if(!notification_id){
        res.status(result.requestbad).send('invalid parameters: no notification identifier');
        return;
    }
  
    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    if(read == null){
        res.status(result.requestbad).send('invalid parameters: no read');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/notifications/' + uid + '/' + notification_id + '/read').set(read);

    res.status(result.requestsuccessful).send('read updated');

});
