const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

//secret
const { TokenSecret } = require('../../config/keys');

//models
const User = require('../../models/user');
const Token = require('../../models/token');
const Role = require('../../models/role');

function generateAccessToken(id, roles){
    const payload = {
        id,
        roles
    };
    return jwt.sign(payload, TokenSecret, { expiresIn: '3m' });
}

function generateRefreshToken(id, roles){
    const payload = {
        id,
        roles
    };
    return jwt.sign(payload, TokenSecret);
}

router.get('/facebook', (req, res) => {
    try {
        const token = req.body.token;
        axios.get(`https://graph.facebook.com/v3.2/me?fields=email&access_token=${token}`).then(async function (response) {
                const email = response.data.email;
                const user = await User.find({'socialAccount.identity': email});
                if (user) {
                    const accessToken = generateAccessToken(user._id, user.roles);
                    const refreshToken = generateRefreshToken(user._id, user.roles);
                    const newToken = new Token({token: refreshToken});
                    await newToken.save();
                    return res.json({accessToken: accessToken, refreshToken: refreshToken});
                }
                else {
                    const userRole = await Role.findOne({value: "USER"});
                    const newUser = new User({ username: email, socialAccount: { type: "facebook", identity: email}, roles:[userRole.value]});
                    await newUser.save();
                    return res.json({ email: email });
                }
            });
    }
    catch (e){
        return res.json({ message: e });
    }
});

module.exports = router;