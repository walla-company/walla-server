// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/update_user_first_name', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var first_name = req.body['first_name'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!first_name){
      res.status(result.requestbad).send('invalid parameters: no first name');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/first_name').set(first_name);

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/last_name').once('value').then(function(snapshot){
          if(snapshot.val())
              databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(first_name + ' ' + snapshot.val());
          else
              res.status(result.requestbad).send('could ot get last name');
      })
      .catch(function(error){
          res.status(result.requestbad).send(error);
          console.log(error);
  });

  res.status(result.requestsuccessful).send('first name updated');

});

