// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
var moment = require('moment');
var moment_tz = require('moment-timezone');

app.get('/api/get_activities', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin && !authentication.read) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    const timequery = (moment().utcOffset("-04:00").startOf('day') * 1.0) / 1000;
    tokenManager.incrementTokenCalls(token);

    databaseref.child('schools/' + school_identifier + '/activities/').orderByChild('start_time').startAt(timequery)
        .once('value').then(function (snapshot) {
            if (snapshot.val()) {

                var activities = [];
                var keys = Object.keys(snapshot.val());
                var current_index = 0;

                if (!uid) {

                    Object.keys(snapshot.val()).forEach(function (key) {
                        var event = snapshot.val();

                        var eventDeleted = false;
                        if (event.hasOwnProperty('deleted')) {
                            eventDeleted = event['deleted'];
                        }

                        if (event[key]["public"] && !eventDeleted) {
                            activities.push(snapshot.val()[key]);
                        }
                    });

                    sortAndSendActivities(activities, res);

                }
                else {
                    userCanSeeFeedEvent(uid, school_identifier, res, activities, snapshot.val(), current_index, keys);
                }
            }
            else {
                res.status(result.requestsuccessful).send({});
            }
        })
        .catch(function (error) {
            res.status(result.requestbad).send(error);
            console.log(error);
        });

});

function sortAndSendActivities(activities, res) {
    activities.sort(compareActivities);
    res.status(result.requestsuccessful).send(activities);
}

function compareActivities(a1, a2) {
    return a2['start_time'] - a1['start_time'];
}

function userCanSeeEvent(uid, auid, school_identifier, res, activity) {
    if (activity["public"]) {
        res.status(result.requestsuccessful).send(activity);

        return;
    } else if (activity["host"] == uid) {
        res.status(result.requestsuccessful).send(activity);

        return;
    }

    for (var user_id in activity["invited_users"]) {
        if (user_id == uid) {
            console.log("Event private: user can see (invited user)");
            res.status(result.requestsuccessful).send(activity);

            return;
        }
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups').once('value').then(function (snapshot) {
        if (snapshot.val()) {
            for (var group_id in activity["invited_groups"]) {
                if (snapshot.val().hasOwnProperty(group_id)) {
                    console.log("Event private: user can see (invited group)");
                    res.status(result.requestsuccessful).send(activity);

                    return;
                }
            }

            res.status(result.requestsuccessful).send({});

            return;
        }
    }).catch(function (error) {
        res.status(result.requestbad).send(error);
        console.log(error);
        res.status(result.requestsuccessful).send({});
        return;
    });
}

function userCanSeeFeedEvent (uid, school_identifier, res, activities, all_activities, current_index, keys) {
    var key = keys[current_index];
    if (!key || (current_index == all_activities.length)) {
        sortAndSendActivities(activities, res);

        return;
    }

    var current_activity = all_activities[key];
    current_index = current_index + 1;

    var eventDeleted = false;
    if (current_activity.hasOwnProperty('deleted')) {
        eventDeleted = current_activity['deleted'];
    }

    if (current_activity["public"]) {
        if (!eventDeleted) {
            activities.push(current_activity);
        }

        userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);

        return;
    } else if (current_activity["host"] == uid) {

        if (!eventDeleted) {
            activities.push(current_activity);
        }

        userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);

        return;
    }

    for (var user_id in current_activity["invited_users"]) {
        if (user_id == uid) {
            if (!eventDeleted) {
                activities.push(current_activity);
            }

            userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);

            return;
        }
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups').once('value').then(function (snapshot) {
        if (snapshot.val()) {
            for (var group_id in current_activity["invited_groups"]) {
                if (snapshot.val().hasOwnProperty(group_id)) {
                    console.log("Event private: user can see (invited group)");

                    if (!eventDeleted) {
                        activities.push(current_activity);
                    }

                    userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);

                    return;
                }
            }

            userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
        }
    }).catch(function (error) {
        res.status(result.requestbad).send(error);
        console.log(error);
        userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
    });
}
