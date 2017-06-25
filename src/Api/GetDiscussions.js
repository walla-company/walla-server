// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');

app.get('/api/get_discussions', function(req, res){
    
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.read){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school_identifier = req.query.school_identifier;
    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }


    var auid = req.query.auid;
    if(!auid){
        res.status(result.requestbad).send('invalid parameters: no auid');
        return;
    }
    
    databaseref.child('schools').child(school_identifier).child('discussions').child(auid).once('value').then(function(snapshot){
            if(snapshot.val())
                res.status(result.requestsuccessful).send(snapshot.val());
            else
                res.status(result.requestsuccessful).send({});
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });
});
