// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/update_user_graduation_year', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var graduation_year = req.body['graduation_year'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!graduation_year){
      res.status(result.requestbad).send('invalid parameters: no graduation year');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/graduation_year').set(graduation_year*1);

  res.status(result.requestsuccessful).send('graduation year updated');

});
