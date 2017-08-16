// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_suggested_users', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  databaseref.child('schools').child(school_identifier).child('users').once('value').then(function(snapshot){
            if(snapshot.val())
                sortAndSendUsers(snapshot.val(), res);
            else
                res.status(result.requestsuccessful).send({});
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });


});

function sortAndSendUsers(users, res){
    var keyArr = Object.keys(users);
    shuffle(keyArr);

    var suggestedUsers = []; //top ten groups to be returned to the user

    var sml = keyArr.length > 10 ? 10 : keyArr.length;
    for(var i = 0; i < sml; i++){
        suggestedUsers.push(users[keyArr[i]]);
    }

    res.status(result.requestsuccessful).send(suggestedUsers);

}

function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};