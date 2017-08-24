// @flow

const _ = require('underscore');
const moment = require('moment');

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const webHelpers = require('../shared/WebConsoleHelpers');

app.get('/api/get_dashboard_data', (req, res) => {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    const school_identifier = req.query['school_identifier'];

    if (!school_identifier) school_identifier = 'duke'; //for tests only

    if(!school_identifier){
        res.status(result.requestbad).send("invalid parameters: no school identifier");
        return;
    }

    const getSchool = databaseref.child('schools').child(school_identifier).once('value');
    const getAllUsers = databaseref.child('users').once('value');
    const getSessionsLog = databaseref.child('sessions_log').once('value');    
    const getSchoolActivities = databaseref.child('schools').child(school_identifier).child('activities').once('value');;

    Promise.all([getSchool, getAllUsers, getSessionsLog, getSchoolActivities]).then(values => {
        //selected school
        const selectedSchool = values[0].val();
        //active groups
        const schoolGroups = selectedSchool.groups || {};
        //sessions
        const sessions_log = values[2].val() ||  {};
        //school activities
        const schoolActivities = values[3].val() || {};
        //count users from selected school
        const schoolUserCount = Object.keys(selectedSchool.users || {}).length;
        //total days recording sessions
        const total_days = Object.keys(sessions_log.sessions_by_day ||  {}).length; //check if we only need sessions by day here
        //total unique user sessions recorded
        const total_unique_sessions = Object.keys(sessions_log.sessions_by_day ||  {})
                            .map(k => Object.keys((sessions_log.sessions_by_day ||  {})[k].sessions).length)
                            .reduce((prev, cur) => prev + cur, 0);

        let totalPlanningTime = 0;
        Object.keys(schoolActivities).map(k => schoolActivities[k])
        .forEach(a => {

            const postedAt = moment(a.timePosted * 1000);
            const eventAt = moment(a.start_time * 1000);

            totalPlanningTime += eventAt.diff(postedAt, 'seconds');
        });

        //count of users from all schools
        const unique_users = values[1].numChildren();
        //Percentage of users who belongs to the selected school
        const percent_school_population = (schoolUserCount / unique_users * 100).toFixed(2);
        //counting daily active unique users
        const daily_active_users = Math.round(total_unique_sessions / total_days);
        //total number of sessions
        const total_number_sessions = sessions_log.total_sessions;
        //avg duration of sessions
        const avg_session_duration = Math.round(sessions_log.total_seconds / total_number_sessions);
        
        //count groups with at least one member and count members from groups of selected school
        let active_groups = 0, schoolMemberCount = 0;
        Object.keys(schoolGroups).forEach(k => {
            const memberCount = Object.keys(schoolGroups[k].members || {}).length;
            if (memberCount) {
                active_groups++;
                schoolMemberCount += memberCount;
            }
        });
        //count avg group size
        const avg_group_size = Math.round(active_groups === 0 ? 0 : schoolMemberCount / active_groups);
        //find groups hosting events
        const groups_hosting = [];
        Object.keys(schoolActivities ||  {}).map(k => schoolActivities[k]).forEach(a => {
            if (a.host_group) {
                groups_hosting.push(a.host_group);
            }
        });
        //avg hosted events by groups
        const avg_hosted_events_by_group = Math.round(groups_hosting.length / (_.unique(groups_hosting).length || 1));

        // events avg planning time
        const events_avg_planning_time = Math.round(totalPlanningTime / Object.keys(schoolActivities).length);

        res.status(result.requestsuccessful).send({
            unique_users,
            percent_school_population,
            daily_active_users,
            total_number_sessions,
            avg_session_duration,
            active_groups,
            avg_group_size,
            avg_hosted_events_by_group,
            events_avg_planning_time
        });

    });
});