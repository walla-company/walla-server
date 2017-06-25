// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_suggested_groups', function(req, res){
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

  databaseref.child('schools').child(school_identifier).child('groups').once('value').then(function(snapshot){
            if(snapshot.val())
                sortAndSendGroups(snapshot.val(), res);
            else
                res.status(result.requestsuccessful).send({});
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });


});

function sortAndSendGroups(groups, res){
    var keyArr = Object.keys(groups);
    shuffle(keyArr);

    var suggestedGroups = []; //top ten groups to be returned to the user

    var sml = keyArr.length > 10 ? 10 : keyArr.length;
    var i;
    for(i = 0; i < sml; i++){
        suggestedGroups.push(groups[keyArr[i]]);
    }

    res.status(result.requestsuccessful).send(suggestedGroups);

}

function shuffle(o){
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};
