// @flow

const databaseref = require('../shared/Firebase');
const request = require('request');

const notificationType =  {
    NOTIFICATIONFRIENDREQUEST:  "friend_request",
    NOTIFICATIONUSERINVITED: "user_invited",
    NOTIFICATIONGROUPINVITED: "group_invited",
    NOTIFICATIONDISCUSSIONPOSTED: "discussion_posted"
};

function sendNotificationToUser(message, title, uid, school_identifier) {
    console.log("Send notification to " + uid + " || " + school_identifier);
    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/notification_tokens').once('value').then(function(snapshot){
            console.log("Notification tokens: " + snapshot.val());
            if(snapshot.val()) {
                
                for (var notification_id in snapshot.val()) {

                    console.log("Notification id: " + notification_id);
                    
                    sendNotification(message, title, notification_id);
                }
            }
        })
}

function sendNotification(message, title, recipient) {

  console.log("Sending notification");

  request(
    {
      method: 'POST',
      uri: 'https://fcm.googleapis.com/fcm/send',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=AAAAPOKlPuE:APA91bEFvSBMpS_5pb8_1GRQAZGgnVLhyKF5RTG5zk-sGBPKm0XRnvNw_J0hhmdJ7Yyidjksgfux3O8-V69k3LDOeFgqP94AEL5uM7lm1fl_mgTtUyCKR-x4H9-qmth4IG1aIVtShxtT'
      },
      body: JSON.stringify({
        "to": recipient,
        "priority": "high",
        "notification" : {
          "body" : message,
          "title": title,
          "sound": "default",
          "badge": 1
        }
      })
    },
    function (error, response, body) {
      if(response.statusCode == 200){

        console.log('Success');
      } else {
        console.log('error: '+ response.statusCode);
      }
    }
  )
}

module.exports = {
    notificationType: notificationType,
    sendNotificationToUser: sendNotificationToUser,
}
