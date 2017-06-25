// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const notificationManager = require('../shared/NotificationManager');
const notificationType = notificationManager.notificationType;

app.post('/api/post_discussion', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.body['school_identifier'];
    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }


    var auid = req.body['auid'];
    if(!auid){
        res.status(result.requestbad).send('invalid parameters: no event key');
        return;
    }

    var uid = req.body['uid'];
    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }
    
    //temporary measure to stop hugh neutron from posting comments
    //delete after better solution has been found
    if(uid === '9SICVXhnRGUB7KB58qiQhZp0XEF2' || uid === '00UELlTJJlhDAn3K2haD2cXmadi1'){
        res.status(result.requestbad).send('user not allowed to post comments');
        return;
    }
    
    var text = req.body['text'];
    if(!text){
        res.status(result.requestbad).send('invalid parameters: no text');
        return;
    }

    var discussion = {
        user_id: uid,
        activity_id: auid,
        text: text,
        time_posted: new Date().getTime() / 1000
    };
    
    var newDiscussionRef = databaseref.child('schools').child(school_identifier).child('discussions').child(auid).push(discussion);
    var discussion_id = newDiscussionRef.key;

    newDiscussionRef.child('discussion_id').set(discussion_id);

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){

        var current_time = new Date().getTime() / 1000;
        console.log('Activity: ' + snapshot.val());

        var activity_title = snapshot.val()['title'];
        
        if (snapshot.val()['replies'] != null) {
            for (var reply_id in snapshot.val()['replies']) {

            if (snapshot.val()['replies'][reply_id] == 'going' && reply_id != uid) {
                var notification = {
                    time_created: current_time*1.0,
                    type: notificationType.NOTIFICATIONDISCUSSIONPOSTED,
                    sender: uid,
                    activity_id: auid,
                    text: 'New discussion in ' + activity_title + ': ' + text,
                    read: false,
                    profile_image_url: ''
                };

                var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + reply_id).push(notification);
                databaseref.child('schools/' + school_identifier + '/notifications/' + reply_id + '/' + notificationRef.key + '/notification_id').set(notificationRef.key);
                
                notificationManager.sendNotificationToUser('New discussion in ' + activity_title, 'Discussion', reply_id, school_identifier);
            
                } 
            
            }
        }
    })
    
    res.status(result.requestsuccessful).send('discussion added');
});
