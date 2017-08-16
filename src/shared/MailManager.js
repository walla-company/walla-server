// @flow
const xoauth2 = require('xoauth2');
const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const nodemailer = require('nodemailer');

const WEBSITE = 'https://walla-server.herokuapp.com';

var apikeytemplate;

const apiTemplate = databaseref.child('templates').child('apikey');
apiTemplate.on('value', snapshot => apikeytemplate = snapshot.val().template);


var transporter = nodemailer.createTransport({
    service: 'Aol',
    auth: {
        user: 'wallanoreply@aol.com',
        pass: 'graysonisthegoat' 
    }
});

var transporter2 = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        xoauth2: xoauth2.createXOAuth2Generator({
            user: 'judy@wallasquad.com',
            clientId: '569447296968-13dk1vkqeo22bs3o145n74bbm62cs30r.apps.googleusercontent.com',
            clientSecret: 'spYxPuyBJ1JzWD4fWpBzcQKF',
            refreshToken: '1/PPP3SfpgKtmgofm1fNZd4r0lh77FCYhKdS4V34h3qCQ',
            accessToken: 'ya29.GluoBHG_ynGeKfJ8iyoP7HBQ9S9C8TG5Ey9yng7u5gL8M-ehXoqH-9FBS_YAicvb23_ACa1ZTiqUm9xpOFc6RWavcKu9Nsx1wI49oPTDfEVRCYvnzaLBTE8pbHUd'
        })
    }
});

function sendTestEmail(to) {
    var mailOptions = {
        from: '"Walla API" <judy@wallasquad.com>',
        to,
        subject: 'Walla API',
        html: 'Hello! This is an email from Walla. This is an email from Walla. This is an email from Walla. Thanks, Bye!'
    };

    transporter2.sendMail(mailOptions, function (error, info) {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: ', info);
    });
}

function sendTokenViaEmail(token, email, name, auth) {
    // TODO(anesu): Find a better a way of doing this

    var permissions = '';
    if (auth.indexOf('read') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Read</p>' + '</li>';
    if (auth.indexOf('write') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Write</p>' + '</li>';
    if (auth.indexOf('delete') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Delete</p>' + '</li>';
    if (auth.indexOf('admin') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Admin</p>' + '</li>';
    if (auth.indexOf('verify') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Verify</p>' + '</li>';

    if (permissions == '') {
        permissions = 'none';
    }

    var mailOptions = {
        from: '"Walla API" <wallanoreply@aol.com>',
        to: email,
        subject: 'Walla API',
        html: apikeytemplate.replace(/permissions-go-here/, permissions).replace(/name-goes-here/, name).replace(/token-goes-here/, token)
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
}

function sendVerificationEmail(email, uid, domain, res){
    
    console.log('Verify: ' + email + ', ' + domain + ', ' + uid);
    
    if(!emailverificationtemplate){
        setTimeout(() => sendVerificationEmail(email, uid), 3000);
    }else{
        var hash = tokenManager.TokenGenerator.generate();
        databaseref.child('schools').child(domain).child('users').child(uid).once('value').then(function(snapshot){
            var user = snapshot.val();
            if(user){
                
                console.log('User exists');
                
                databaseref.child('schools').child(domain).child('users').child(uid).child('hash').set(hash);

                var verifyurl = WEBSITE + '/api/verify?domain=' + domain + '&uid=' + uid + '&token=' + '34c27dF4ad7X72' + '&hash=' + hash;
                var mailOptions = {
                    from: '"Walla" <wallanoreply@aol.com>', // sender address
                    to: email, // list of receivers
                    subject: 'Verify email', // Subject line
                    html: emailverificationtemplate.replace(/verify-url-here/, verifyurl)
                };

            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    console.log(error);
                    console.log(error);
                    res.status(result.requestbad).send(error);
                    return
                }
                console.log('Message sent: ' + info.response);
                res.status(result.requestsuccessful).send('email sent');
            });

            }else{
                res.status(result.requestnotfound).send('user not found');
            }
        });

    }
}

module.exports = {
    sendTokenViaEmail: sendTokenViaEmail,
    sendVerificationEmail: sendVerificationEmail,
    sendTestEmail: sendTestEmail,
}
