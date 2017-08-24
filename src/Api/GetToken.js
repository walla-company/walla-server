// @flow

const app = require('../shared/Express');
const result = require('../shared/RequestResult');

app.post('/api/token', (req, res) => {
    const user = req.body;
    if (user && user.email === 'Dz56@duke.edu' && user.password === 'hellohello') {
        return res.json({
            token: '3eaf7dFmNF447d'
        });
    }
    res.send(result.requestunauthorized, 'email and password does not match');
});