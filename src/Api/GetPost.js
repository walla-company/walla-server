// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_activity', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.read){
         res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var auid = req.query.auid;
    var uid = req.query.uid;

    if(!auid){
        res.status(result.requestbad).send(result.invalidparams + ' : no auid');
        return;
    }

    if(!school_identifier){
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }
    
    if(!uid){
        //res.status(REQUESTBAD).send("invalid parameters: no uid");
        databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                res.status(result.requestsuccessful).send(snapshot.val());
            }
            else {
                res.status(result.requestsuccessful).send({});
            }
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
        });
        return;
    }
    
    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                userCanSeeEvent(uid, auid, school_identifier, res, snapshot.val());
            }
            else {
                res.status(result.requestsuccessful).send({});
            }
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });

});

function userCanSeeEvent(uid, auid, school_identifier, res, activity) {  
        const activityRef = databaseref.child('schools/' + school_identifier + '/activities/' + auid);
        let newSeen = false;
        const sendSuccess = () => {
            activityRef.child('seen').transaction(seenObj => {
                seenObj = seenObj || {};
                newSeen = false;
                if (!seenObj[uid]) {
                    seenObj[uid] = new Date().getTime() / 1000;
                    newSeen = true;
                }
                // always update last seen date
                return seenObj;
            }).then(() => {
                console.log(newSeen);
                return !newSeen ? null : activityRef.child('seen_count')
                .transaction(seenCount => (seenCount || 0) + 1);
            })
            .then(() => activityRef.once('value'))
            .then(snapshot => res.status(result.requestsuccessful).send(snapshot.val()));
        };

        if (activity["public"]) {       
            console.log("Event public");
            return sendSuccess();
        }
        else if (activity["host"] == uid) {
                    
            console.log("Event private: user can see (host)");
            return sendSuccess();
        }
                
        for (var user_id in activity["invited_users"]) {
            if (user_id == uid) {
                
                console.log("Event private: user can see (invited user)");
                return sendSuccess();
            }
        }
    
        databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups').once('value').then(function(snapshot){
            if(snapshot.val()) {
                
                for (var group_id in activity["invited_groups"]) {
                    if (snapshot.val().hasOwnProperty(group_id)) {
                        
                        console.log("Event private: user can see (invited group)");
                        return sendSuccess();
                    }
                }
                
                console.log("Event private: user cannot see");
                return sendSuccess();
            }
        }).catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
            console.log("Event private: user cannot see");
            res.status(result.requestsuccessful).send({});
            return;
    });
}
