// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const notificationManager = require('../shared/NotificationManager');

app.post('/api/send_notification_to_user', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.body.school_identifier;
    var uid = req.body.uid;
    var message = req.body.message;
    var title = req.body.title;

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }
    
    if(!message){
        res.status(result.requestbad).send('invalid parameters: no message');
        return;
    }

    
    if(!title){
        res.status(result.requestbad).send('invalid parameters: no title');
        return;
    }


    notificationManager.sendNotificationToUser(message, title, uid, school_identifier);

    res.status(result.requestsuccessful).send('notification sent');

});
