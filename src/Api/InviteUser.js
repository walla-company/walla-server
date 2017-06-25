// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const notificationManager = require('../shared/NotificationManager');
const notificationType = notificationManager.notificationType;

app.post('/api/invite_user', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin && !authentication.write) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var sender = req.body['sender'];
    var uid = req.body['uid'];
    var school_identifier = req.body['school_identifier'];
    var auid = req.body['auid'];

    if (!uid) {
        res.status(result.requestbad).send(result.invalidparams + ' no uid');
        return;
    }

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + 'no school identifier');
        return;
    }

    if (!auid) {
        res.status(result.requestbad).send(result.invalidparams + ' no auid');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function (snapshot) {

        console.log("Activity: " + snapshot.val());

        if (snapshot.val()) {

            inviteUser(sender, uid, school_identifier, auid, snapshot.val()["title"]);
        }
    })
        .catch(function (error) {
            res.status(result.requestbad).send(error);
            console.log(error);
        });

    res.status(result.requestsuccessful).send('User invited');

});

const inviteUser = (sender, uid, school_identifier, auid, activity_title) => {
    if (sender) {
        databaseref.child('schools/' + school_identifier + '/users/' + sender).once('value').then(function (snapshot) {

            if (snapshot.val()) {
                var current_time = new Date().getTime() / 1000;
                var notification = {
                    time_created: current_time * 1.0,
                    type: notificationType.NOTIFICATIONUSERINVITED,
                    sender: sender,
                    activity_id: auid,
                    text: snapshot.val()["first_name"] + " " + snapshot.val()["last_name"] + " invited you to " + activity_title,
                    read: false,
                    profile_image_url: snapshot.val()["profile_image_url"]
                };

                var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + uid).push(notification);
                databaseref.child('schools/' + school_identifier + '/notifications/' + uid + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);

                databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/invited_users/' + uid).set(current_time);

                notificationManager.sendNotificationToUser(snapshot.val()["first_name"] + " " + snapshot.val()["last_name"] + " invited you to " + activity_title, "Invited", uid, school_identifier);
            }
        })
            .catch(function (error) {
                console.log(error);
            });
    } else {
        var current_time = new Date().getTime() / 1000;
        var notification = {
            time_created: current_time * 1.0,
            type: notificationType.NOTIFICATIONUSERINVITED,
            sender: uid,
            activity_id: auid,
            text: "You were invited to " + activity_title,
            read: false,
            // TODO(anesu): Add actual profile pic
            profile_image_url: '',
        };

        var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + uid)
            .push(notification);
        databaseref.child('schools/' + school_identifier + '/notifications/' + uid + "/" + notificationRef.key + "/notification_id")
            .set(notificationRef.key);
        databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/invited_users/' + uid)
            .set(current_time);

    }
}
