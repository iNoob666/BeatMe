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

router.post('/instagram', (req, res) => {
    try {
        const { token, userid } = req.body;
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
                    return res.json({ email: id });
                }
            }.bind(res))
            .catch((err) => {
                return res.json({ message: "Не удалось зарегестрировать пользователя через ВК"});
            })
    }
    catch (e){
        return res.json({ message: e });
    }
});

module.exports = router;