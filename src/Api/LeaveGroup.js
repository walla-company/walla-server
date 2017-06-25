// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/leave_group', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var guid = req.body['guid'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!guid){
      res.status(result.requestbad).send('invalid parameters: no guid');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/groups/' + guid + '/members/' + uid).remove();

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups/' + guid).remove();

  res.status(result.requestsuccessful).send('interested changed');

});
