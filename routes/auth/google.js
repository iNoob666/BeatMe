const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const User = require('../../models/user');
const Role = require('../../models/role');
const Token = require('../../models/token');

const { TokenSecret } = require('../../config/keys');

const GOOGLE_CLIENT_ID = '745917081582-981ajg99v9nitkoknac51sl8novc6lu4.apps.googleusercontent.com';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);


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

router.post('/google', (req, res) =>{
    const { idToken } = req.body;

    console.log(idToken);

    client.verifyIdToken({idToken: idToken, audience: GOOGLE_CLIENT_ID})
        .then(async (result) => {
            const { email_verified, email } = result.payload;
            if(email_verified){
                const user = await User.findOne( { 'socialAccount.identity': email });
                if(user){
                    const accessToken = generateAccessToken(user._id, user.roles);
                    const refreshToken = generateRefreshToken(user._id, user.roles);
                    const newToken = new Token({token: refreshToken});
                    await newToken.save();
                    return res.json({accessToken: accessToken, refreshToken: refreshToken, username: user.username});
                }
                else {
                    return res.json({ identity: email, type: "google" });
                }
            }
        })
});

module.exports = router;