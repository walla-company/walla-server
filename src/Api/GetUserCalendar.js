// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_user_calendar', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.read){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar').once('value').then(function(snapshot){
            if(snapshot.val()) {              
              checkIfActivityDeletedForCalendar(snapshot.val(), 0, {}, res, school_identifier);
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

function checkIfActivityDeletedForCalendar(activity_ids, index, return_activities, res, school_identifier) {
  
  console.log('Index: ' + index + ' :::: ' + (activity_ids.length));
  
  if (index == Object.keys(activity_ids).length) {
    res.status(result.requestsuccessful).send(return_activities);
    
    return;
  }
  
  var auid = Object.keys(activity_ids)[index];
  
  console.log('Check if deleted: ' + auid);
  
  databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
    
    if(snapshot.val()) {
      
      var eventDeleted = false;

      if(snapshot.val().hasOwnProperty('deleted')){
        eventDeleted = snapshot.val()['deleted'];
      }
                  
      if(!eventDeleted){
        //return_activities.push(auid);
        return_activities[auid] = activity_ids[auid];
      }
    }
    
    index = index + 1;
    checkIfActivityDeletedForCalendar(activity_ids, index, return_activities, res, school_identifier);
    return;
    
  }).catch(function(error){
    console.log('Error');
    res.status(result.requestbad).send(error);
    return;
  });
  
}
