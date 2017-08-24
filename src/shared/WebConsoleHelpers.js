
const databaseref = require('../shared/Firebase');

function filterActivities(activities, filter, school_identifier) {
    return new Promise(resolve => {
        if (!activities || !filter) return resolve(activities);
        
        databaseref.child("schools").child(school_identifier).child("flagged_activities").once('value').then(snapshot => {
            const flagged_activities = snapshot.val() || {};
            resolve(activities.filter(actv => {
                if (!actv.activity_id || actv.deleted) return false;

                const flags = flagged_activities[actv.activity_id];
                if (flags && Object.keys(flags).filter(k => flags[k]).length) {
                    actv.flagged = true;
                }

                return !Object.keys(filter).some(field => {
                    let filterValue = filter[field];
                    let actvValue = actv[field];
                    if (!filterValue) return false;
                    filterValue = filterValue.toString().toLowerCase();
                    if (actvValue) {
                        actvValue = actvValue.toString().toLowerCase();
                    } else actvValue = "";

                    if (field === "flagged") {
                        const flags = flagged_activities[actv.activity_id];
                        return filterValue ^ !actv.flagged;
                    } else if (field === 'start_time') {
                        if (!filterValue || !actvValue) return false;
                        return !(actvValue >= filterValue);
                    } else if (field === 'end_time') {
                        if (!filterValue || !actv['start_time']) return false;
                        return !(actv['start_time'] <= filterValue);
                    } else if (filterValue[0] === '=') {
                        filterValue = filterValue.substring(1);
                        if (!filterValue || !actvValue) return false;
                        return filterValue != actvValue;
                    } else {
                        return actvValue.indexOf(filterValue) === -1;
                    }
                });
            }));
        });
    });
}


function filterUsers(users, filter, school_identifier) {
    return new Promise(resolve => {
        if (!users || !filter) resolve(users);

        let groupMembersId;
        return new Promise(resolveGroup => {
            if (!filter.group) resolveGroup();
            else {
                databaseref.child('schools').child(school_identifier).child('groups').child(filter.group).once('value').then(snapshot => {
                    const group = snapshot.val();
                    if (group && group.members) {
                        groupMembersId = Object.keys(group.members);
                        if (!groupMembersId.length) groupMembersId = null;
                    }
                    resolveGroup();
                });
            }
        }).then(() => {
            const tmpUsers = {};
            Object.keys(users).forEach(k => {
                const u = users[k];
                if (!u.user_id) return;

                if (!Object.keys(filter).some(field => {
                    let filterValue = filter[field];

                    if (field === 'group') {
                        return !groupMembersId || !groupMembersId.includes(u.user_id);
                    } else if (field === 'flagged') {
                        
                    }

                    let userValue = u[field];
                    if (!filterValue) return false;
                    filterValue = filterValue.toString().toLowerCase();
                    if (userValue) {
                        userValue = userValue.toString().toLowerCase();
                    } else userValue = "";
                    if (filterValue[0] === '=') {
                        filterValue = filterValue.substring(1);
                        if (!filterValue) return false;
                        return filterValue != userValue;
                    } else {
                        return userValue.indexOf(filterValue) === -1;
                    }
                })) {
                    tmpUsers[k] = u;
                }
            });

            resolve(tmpUsers);
        });
    });
}

function changeUserSuspension(school_identifier, uid, suspended) {
    return databaseref.child('schools').child(school_identifier).child('users').child(uid).child('suspended').set(suspended);
}

module.exports = {
    filterActivities,
    filterUsers,
    changeUserSuspension
};