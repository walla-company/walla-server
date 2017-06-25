// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const notificationManager = require('../shared/NotificationManager');
const notificationType = notificationManager.notificationType;

app.post('/api/request_friend', function(req, res){
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

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/sent_friend_requests/' + friend).once('value').then(function(snapshot){
            if(!snapshot.val()) {

              databaseref.child('schools/' + school_identifier + '/users/' + uid).once('value').then(function(snapshot){

                      console.log('User: ' + snapshot.val());

                      if (snapshot.val()) {

                        var current_time = new Date().getTime() / 1000;

                        databaseref.child('schools/' + school_identifier + '/users/' + uid + '/sent_friend_requests/' + friend).set(current_time);
                        databaseref.child('schools/' + school_identifier + '/users/' + friend + '/received_friend_requests/' + uid).set(current_time);

                        var notification = {
                          time_created: current_time*1.0,
                          type: notificationType.NOTIFICATIONFRIENDREQUEST,
                          sender: uid,
                          activity_id: '',
                          text: snapshot.val()['first_name'] + ' ' + snapshot.val()['last_name'] + ' sent you a friend request!',
                          read: false,
                          profile_image_url: snapshot.val()['profile_image_url']
                        };

                        var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + friend).push(notification);
                        databaseref.child('schools/' + school_identifier + '/notifications/' + friend + '/' + notificationRef.key + '/notification_id').set(notificationRef.key);
                        
                        notificationManager.sendNotificationToUser(snapshot.val()['first_name'] + ' ' + snapshot.val()['last_name'] + ' sent you a friend request!', 'Friend Request', friend, school_identifier);
                      }
                  })
                  .catch(function(error){
                      res.status(result.requestbad).send(error);
                      console.log(error);
              });
            }
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });

    res.status(result.requestsuccessful).send('success');

});
