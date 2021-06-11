const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

//const
const CLIENT_ID = '546923653380217';
const CLIENT_SECRET = '63936ecb13fc8e66f06ea766ea09d4e8';
const REDIRECT_URI = 'https://beatme.online/';

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

router.post('/instagram', (req, res) => {
    try {
        const { code } = req.body;
        console.log("CODE: ", code);

        axios.post('https://api.instagram.com/oauth/access_token', {
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    redirect_uri: REDIRECT_URI,
                    code: code
                }, {
            headers: {'Content-Type': 'application/x-www-form-urlencoded' }
        })
        // axios({
        //     method: 'post',
        //     url: 'https://api.instagram.com/oauth/access_token',
        //     data: {
        //         client_id: CLIENT_ID,
        //         client_secret: CLIENT_SECRET,
        //         grant_type: 'authorization_code',
        //         redirect_uri: REDIRECT_URI,
        //         code: code
        //     },
        //     headers: {'Content-Type': 'multipart/form-data' }
        // })
            .then(function (accessResponse){
                console.log("INSTAGRAM RESPONSE: ", accessResponse.data);
                const { token, userid } = accessResponse.data;
                axios.get(`https://graph.instagram.com/${userid}?fields=id&access_token=${token}`)
                    .then(async function (response){
                        console.log("response: ", response.data);
                        const { id } = response.data;
                        console.log("id: ", id);
                        const user = await User.findOne({'socialAccount.identity': id});
                        if (user) {
                            const accessToken = generateAccessToken(user._id, user.roles);
                            const refreshToken = generateRefreshToken(user._id, user.roles);
                            const newToken = new Token({token: refreshToken});
                            await newToken.save();
                            return res.json({accessToken: accessToken, refreshToken: refreshToken});
                        }
                        else {
                            const userRole = await Role.findOne({value: "USER"});
                            const newUser = new User({ username: id, socialAccount: { type: "instagram", identity: id}, roles:[userRole.value]});
                            await newUser.save();
                            return res.json({ identity: id });
                        }
                    }.bind(res))
                    .catch((err) => {
                        return res.json({ message: "Не удалось зарегестрировать пользователя через instagram"});
                    })
            }.bind(res))
            .catch((err) => {
                return res.json({ message: "Не удалось получить access token у instagram"});
            })
            .finally(console.log)
    }
    catch (e){
        return res.json({ message: e });
    }
});

module.exports = router;