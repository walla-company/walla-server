const databaseref = require('./Firebase');

const validateReferenceMap = {
    CreatedActivity: true,
    AttendToActivity: true,
    ActivityAttended: true,
    ProfileCompleted: false
};

/*
    types:
     - CreatedActivity
     - AttendToActivity
     - ActivityAttended
     - ProfileCompleted
*/
function addPointsToUser(type, school_identifier, user_id, value, msg, reference) {
    return new Promise((resolve, reject) => {
        let error;
        if (!type) {
            error = 'type not informed';
        } else if (!school_identifier) {
            error = 'school_identifier not informed';
        } else if (!user_id) {
            error = 'user_id not informed';
        } else if (!value) {
            error = 'value not informed';
        }
        if (error) {
            reject(new Error(error));
        } else {
            const userPointsRef = databaseref.child(`points/${user_id}`);
            userPointsRef.once('value').then(snapshot => {
                const pointsAlreadyTaken = (snapshot.val() || [])
                    .some(point => point.type === type && (!validateReferenceMap[type] || point.reference === reference));
                if (pointsAlreadyTaken) {
                    reject(new Error('points already taken'));
                } else {
                    const addToLog = userPointsRef.transaction(arr => {
                        const tmpArray = arr || [];
                        const pointLog = {
                            type,
                            msg,
                            value,
                            time_created: new Date().getTime() / 1000
                        };
                        if (reference) pointLog.reference = reference;
                        tmpArray.push(pointLog);
                        return tmpArray;
                    });
                    const addToPoints = databaseref.child(`schools/${school_identifier}/users/${user_id}/points`)
                        .transaction(points => {
                            points = (points || 0) + value;
                            return points < 0 ? 0 : points;
                        });
                    Promise.all([addToLog, addToPoints]).then(resolve, reject);
                }
            }, reject);
        }
    });
}

// specific method to handle only once all validations
function addProfileCompletionPointsToUser(school_identifier, user_id) {
    databaseref.child('schools/' + school_identifier + '/users/' + user_id).once('value').then(snapshot => {
        const user = snapshot.val();
        if (!user) return;
        if (!user.first_name) return;
        if (!user.last_name) return;
        if (!user.email) return;
        if (!user.profile_image_url) return;
        if (!user.major) return;
        if (!user.hometown) return;
        if (!user.graduation_year) return;
        if (!user.academic_level) return;
        if (!user.description) return;
        if (!Object.keys(user.interests).length) return;

        addPointsToUser('ProfileCompleted', school_identifier, user_id, 10, 'User completed profile');
    });
}

module.exports = {
    addPointsToUser,
    addProfileCompletionPointsToUser,
};

// {
//     points: {
//         user_id: [
//             {
//                 type: '',
//                 time_created: timespan,
//                 value: 0,
//                 reference: some_reference_id,
//                 msg: 'some optional msg'
//             }
//         ]
//     }
// }