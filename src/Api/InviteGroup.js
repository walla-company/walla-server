// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const notificationManager = require('../shared/NotificationManager');
const notificationType = notificationManager.notificationType;

app.post('/api/invite_group', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin && !authentication.write) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var guid = req.body['guid'];
    var school_identifier = req.body['school_identifier'];
    var auid = req.body['auid'];

    if (!guid) {
        res.status(result.requestbad).send(result.invalidparams + ' no guid');
        return;
    }

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    if (!auid) {
        res.status(result.requestbad).send(result.invalidparams + ' no auid');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function (snapshot) {

        console.log("Activity: " + snapshot.val());

        if (snapshot.val()) {

            inviteGroup(guid, school_identifier, auid, snapshot.val()["title"]);
        }
    })
        .catch(function (error) {
            res.status(result.requestbad).send(error);
            console.log(error);
        });

    res.status(result.requestsuccessful).send('Group invited');

});

const inviteGroup = (guid, school_identifier, auid, activity_title) => {
    console.log('Invite group: ' + guid);

    databaseref.child('schools/' + school_identifier + '/groups/' + guid).once('value').then(function (snapshot) {

        var current_time = new Date().getTime() / 1000;
        console.log("Group: " + snapshot.val());

        if (snapshot.val()["members"] != null) {
            for (var member_id in snapshot.val()["members"]) {

                var notification = {
                    time_created: current_time * 1.0,
                    type: notificationType.NOTIFICATIONGROUPINVITED,
                    sender: guid,
                    activity_id: auid,
                    text: snapshot.val()["name"] + " was invited to " + activity_title,
                    read: false,
                    profile_image_url: ""
                };

                var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + member_id).push(notification);
                databaseref.child('schools/' + school_identifier + '/notifications/' + member_id + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);

                databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/invited_groups/' + guid).set(current_time);

                notificationManager.sendNotificationToUser(snapshot.val()["name"] + " was invited to " + activity_title, "Group Invited", member_id, school_identifier);
            }
        }
    })
}
