// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/add_activity', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin && !auth.write) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.body['school_identifier'];
    var title = req.body['title'];
    var start_time = req.body['start_time'];
    var end_time = req.body['end_time'];
    var location_name = req.body['location_name'];
    var location_address = req.body['location_address'];
    var location_lat = req.body['location_lat'];
    var location_long = req.body['location_long'];
    var interests = req.body['interests'];
    var host = req.body['host'];
    var host_group = req.body['host_group'];
    var host_group_name = req.body['host_group_name'];
    var host_group_short_name = req.body['host_group_short_name'];

    /* Not required in request */
    var activity_public = true; // req.body['activity_public'];
    var details = ""; // req.body['details'];
    var invited_users = []; // req.body['invited_users'];
    var invited_groups = []; // req.body['invited_groups'];
    var can_others_invite = true; // req.body['can_others_invite'];

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    if (!title) {
        res.status(result.requestbad).send(result.invalidparams + ' no title');
        return;
    }

    if (!start_time) {
        res.status(result.requestbad).send(result.invalidparams + ' no start time');
        return;
    }

    if (!end_time) {
        res.status(result.requestbad).send(result.invalidparams + '  no end time');
        return;
    }

    if (!location_name) {
        res.status(result.requestbad).send(result.invalidparams + ' no location name');
        return;
    }

    if (!location_address) {
        //res.status(result.requestbad).send("invalid parameters: no location address");
        //return;
        location_address = "";
    }

    if (!location_lat) {
        //res.status(result.requestbad).send("invalid parameters: no location lat");
        //return;
        location_lat = 0;
    }

    if (!location_long) {
        //res.status(result.requestbad).send("invalid parameters: no location long");
        //return;
        location_long = 0;
    }

    if (activity_public == null) {
        //res.status(result.requestbad).send("invalid parameters: no activity public");
        //return;
        activity_public = true;
    }

    if (!interests) {
        //res.status(result.requestbad).send("invalid parameters: no interests");
        //return;
        interests = [];
    }

    if (!host) {
        res.status(result.requestbad).send(result.invalidparams + ' no host');
        return;
    }

    if (can_others_invite == null) {
        can_others_invite = true;
    }

    if (!details) {
        details = "";
    }

    if (!host_group) {
        host_group = "";
    }

    if (!host_group_name) {
        host_group_name = "";
    }

    if (!host_group_short_name) {
        host_group_short_name = "";
    }

    if (!invited_users) {
        invited_users = [];
    }

    if (!invited_groups) {
        invited_groups = [];
    }

    if (title.length > 500) {
        res.status(result.requestbad).send(result.invalidparams + ' title too long');
        return;
    }

    if (details.length > 1000) {
        res.status(result.requestbad).send(result.invalidparams + ' details too long');
        return;
    }

    var current_time = new Date().getTime() / 1000;

    var invited_users_dic = {};
    var invited_groups_dic = {};
    /*
    invited_users.forEach( function(uid) {
      invited_users_dic[uid] = current_time;
    });

    invited_groups.forEach( function(guid) {
      invited_groups_dic[guid] = current_time;
    });
    */
    var reply = {};

    // fake data. uncomment to have fake data on new activities
    // var fake_interested_uids = ['j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r'];
    // var fake_interested = getRandomInt(2, 5);

    // for (var i = 0; i <= fake_interested; i++) {
    //     reply[fake_interested_uids[i]] = 'interested';
    // }

    reply[host] = "going";

    var activity = {
        title: title,
        start_time: start_time * 1.0,
        end_time: end_time * 1.0,
        location: {
            name: location_name,
            address: location_address,
            lat: location_lat * 1.0,
            long: location_long * 1.0
        },
        public: activity_public,
        can_others_invite: can_others_invite,
        interests: interests,
        host: host,
        details: details,
        host_group: host_group,
        host_group_name: host_group_name,
        host_group_short_name: host_group_short_name,
        invited_users: invited_users_dic,
        invited_groups: invited_groups_dic,
        replies: reply,
        deleted: false
    };

    var newActivityRef = databaseref.child('schools/' + school_identifier + '/activities').push(activity);
    var auid = newActivityRef.key;

    newActivityRef.child('activity_id').set(auid);

    if (host_group != "") {
        databaseref.child('schools/' + school_identifier + '/groups/' + host_group + '/activities/' + auid).set(current_time);
    }

    databaseref.child('schools/' + school_identifier + '/users/' + host + '/activities/' + auid).set(current_time);

    databaseref.child('schools/' + school_identifier + '/users/' + host + '/calendar/' + auid).set(current_time);

    /*
    console.log('invited_users: ' + invited_users);
    console.log('invited_groups: ' + invited_groups);

    invited_users.forEach( function(uid) {
      inviteUser(host, uid, school_identifier, auid, title);
    });

    invited_groups.forEach( function(guid) {
      inviteGroup(guid, school_identifier, auid, title);
    });
    */

    pointsManager.addPointsToUser('CreatedActivity', school_identifier, host, 5, 'User created activity id ' + auid, auid);
    res.status(result.requestsuccessful).send('activity posted: ' + activity['location']['lat']);
});

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}
