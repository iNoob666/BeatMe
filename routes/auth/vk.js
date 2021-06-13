const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

//const
const CLIENT_SECRET = 'U6YVOpNogZN0JZ4EUNp9';
const CLIENT_ID = 7865550;
const REDIRECT_URI = 'https://beatme.online';

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

router.post('/vk', (req, res) => {
    try {
        const { code } = req.body;
        axios.get(`https://oauth.vk.com/access_token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${REDIRECT_URI}&code=${code}`)
            .then(function (response){
                const { access_token } = response.data;
                axios.get(`https://api.vk.com/method/users.get?access_token=${access_token}&v=5.131`)
                    .then(async function (response){
                        const { id } = response.data.response[0];
                        const user = await User.findOne({'socialAccount.identity': id});
                        if (user) {
                            const accessToken = generateAccessToken(user._id, user.roles);
                            const refreshToken = generateRefreshToken(user._id, user.roles);
                            const newToken = new Token({token: refreshToken});
                            await newToken.save();
                            return res.json({accessToken: accessToken, refreshToken: refreshToken, username: user.username});
                        }
                        else {
                            const userRole = await Role.findOne({value: "USER"});
                            const newUser = new User({ username: id, socialAccount: { type: "vk", identity: id}, roles:[userRole.value]});
                            await newUser.save();
                            return res.json({ identity: id });
                        }
                    }.bind(res))
                    .catch((err) => {
                        return res.json({ message: "Не удалось зарегестрировать пользователя через ВК"});
                    })
            }.bind(res))
            .catch((err) => {
                return res.json({ message: "Не удалось получить access token у ВК"});
            })
    }
    catch (e){
        return res.json({ message: e });
    }
});

module.exports = router;