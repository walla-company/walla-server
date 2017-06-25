// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const notificationManager = require('../shared/NotificationManager');
const notificationType = notificationManager.notificationType;

app.post('/api/ignore_friend_request', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.body['school_identifier'];
    console.log(school_identifier);
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

    databaseref.child('schools/' + school_identifier + '/notifications/' + uid).once('value').then(function(snapshot){

            console.log('Notifications: ' + snapshot.val());

            if(snapshot.val()) {

              for (var notification_id in snapshot.val()) {

                console.log('notification_id: ' + notification_id);
                console.log('notification type: ' + snapshot.val()[notification_id]['type']);
                console.log('notification sender: ' + snapshot.val()[notification_id]['sender']);

                if (snapshot.val()[notification_id]['type'] === notificationType.NOTIFICATIONFRIENDREQUEST) {
                  if (snapshot.val()[notification_id]['sender'] === friend) {
                    databaseref.child('schools/' + school_identifier + '/notifications/' + uid + '/' + notification_id).remove();
                  }
                }
              }

            }
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });

    var current_time = new Date().getTime() / 1000;

    databaseref.child('schools/' + school_identifier + '/users/' + friend + '/sent_friend_requests/' + uid).remove();
    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/received_friend_requests/' + friend).remove();

    res.status(result.requestsuccessful).send('success');

});
