// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const webHelpers = require('../shared/WebConsoleHelpers');

app.get('/api/get_all_activities', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var filter = req.query.filter;
    if (filter) filter = JSON.parse(filter);

    if(!school_identifier){
        res.status(result.requestbad).send("invalid parameters: no school identifier");
        return;
    }
    
    databaseref.child('schools/' + school_identifier + '/activities/').once('value').then(snapshot => {
        let activities = snapshot.val();
        if (!activities) {
            return res.status(result.requestsuccessful).send({});
        }

        activities = Object.keys(activities).map(k => activities[k]);
        webHelpers.filterActivities(activities, filter, school_identifier).then(activities => res.status(result.requestsuccessful).send(activities));
    });

});