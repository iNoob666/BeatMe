//packages
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');
const { check, validationResult } = require("express-validator");

//passport
require('./config/passport-google');

//https config
const { CertificateKey } = require('./config/keys');
const options = {
    key: fs.readFileSync('certificate/beatme_online.key', 'utf8'),
    cert: fs.readFileSync('certificate/beatme_online.full.crt', 'utf8'),
    passphrase: CertificateKey
};

//DB schemas
const User = require('./models/user');
const Token = require('./models/token');
const Role = require('./models/role');
const PassCode = require('./models/passcode');

//jwt secret key
const { TokenSecret } = require('./config/keys');

//app initializing
const authServer = express();
authServer.use(cors())
const PORT = process.env.AUTH_PORT || 9000;

//DB config
const DB = require('./config/keys').MongoURI;

//Connect to MongoDB
mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.log(err));
mongoose.set('useCreateIndex', true);

//Body-parser
authServer.use(bodyParser.json());
authServer.use(bodyParser.urlencoded({ extended: false }));


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

authServer.post('/token', async (req, res) => {
    try{
        const refreshToken = req.body.token;
        if(!refreshToken){
            return res.sendStatus(401).json({message: "Обновляющий токен пуст"});
        }
        const validToken = await Token.findOne({token: refreshToken});
        if(!validToken){
            return res.sendStatus(401).json({message: "Обновляющий токен не найден среди активных клиентов"});
        }
        jwt.verify(refreshToken, TokenSecret, (err, user) => {
            if(err){
                return res.sendStatus(401).json({message: "Обновляющий токен не прошел верификацию"});
            }
            const accessToken = generateAccessToken(user._id, user.roles);
            res.json({accessToken: accessToken});
        });
    }
    catch (err){
        console.log(err);
        res.sendStatus(401).json({message: "Не удалось обновить токен"});
    }
});

authServer.post('/phone', async (req, res) => {
    const { phoneNumb } = req.body;
    const user = await User.findOne({ phone: phoneNumb });
    if(!user){
        //Если пользователь не существует
        //отправка смс с кодом

        //заглушка
        const passCode = "4444";
        const hashPassCode = bcrypt.hashSync(passCode, 10);
        const passcode = new PassCode({ phoneNumb: phoneNumb, hashPassCode: hashPassCode });
        passcode.save();
        res.json({ exist: false, phoneNumb: phoneNumb});
    }
    else {
        res.json({ exist: true, phoneNumb: phoneNumb });
    }
});

authServer.post('/passcode', async (req, res) => {
    const { phoneNumb, passCode } = req.body;
    const userPassCode = await  PassCode.findOne({ phoneNumb: phoneNumb });
    if(!userPassCode){
        return res.sendStatus(401).json({ message: "истек срок кода" });
    }
    const validPassCode = bcrypt.compareSync(passCode, userPassCode.hashPassCode);
    if(!validPassCode){
        return res.json({ confirm: false });
    }
    await PassCode.findByIdAndDelete(userPassCode._id);
    return res.json( { confirm: true, phoneNumb: phoneNumb });
});

authServer.post('/login', async (req, res) => {
    try {
        const { phoneNumb, password } = req.body;
        const user = await User.findOne({ phoneNumb: phoneNumb })
        if(!user){
            return res.sendStatus(401).json({message: `Пользователя с номером ${phoneNumb} не существует`})
        }
        const validPassword = bcrypt.compareSync(password, user.password);

        if(!validPassword){
            return res.sendStatus(401).json({message: "Введен неверный пароль"});
        }

        const accessToken = generateAccessToken(user._id, user.roles);
        const refreshToken = generateRefreshToken(user._id, user.roles);
        const newToken = new Token({token: refreshToken});
        await newToken.save();
        res.json({accessToken: accessToken, refreshToken: refreshToken})
    }
    catch (err){
        console.log(err);
        res.sendStatus(401).json({message: "Не удалось войти в профиль пользователя"});
    }
});

authServer.post('/register',[
    check("username", "invalid username")
        .isLength({ min: 3, max: 16 }).withMessage('Имя пользователя должно быть от 3 до 16 знаков')
        .matches(/^[A-Za-z\s]+$/).withMessage('Имя пользователя должно быть на Английском языке'),
    check("password")
        .isLength({ min: 6, max: 32 }).withMessage('Пароль должен быть от 6 до 32 знаков')
        .custom((value,{req, loc, path}) => {
            if (value !== req.body.confirmedPass) {
                // trow error if passwords do not match
                throw new Error("Passwords don't match");
            } else {
                return value;
            }
        }).withMessage('Пароли должны совпадать')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if(errors){
            return res.json(errors);
        }

        const { phoneNumb, username, password } = req.body;

        const candidate = await User.findOne({username});
        if(candidate){
            return res.sendStatus(401).json({message: "Пользователь с таким именем уже существует"});
        }
        const hashPassword = bcrypt.hashSync(password, 10);
        const userRole = await Role.findOne({value: "USER"});
        const newUser = new User({username: username, phoneNumb: phoneNumb, password: hashPassword, roles:[userRole.value]});
        await newUser.save();
        return res.sendStatus(200);
    }
    catch (err){
        console.log(err);
        res.sendStatus(401).json({message: "Не удалось зарегестрировать пользователя"});
    }
});

authServer.delete('/logout', async (req, res) => {
    const refreshToken = req.body.token;

    await Token.deleteOne({token: refreshToken}, (err, token) => {
        if(err) {
            return res.sendStatus(401).json({message: "Не удалось закончить сессию"});
        }
        res.sendStatus(200);
    });
});



const httpsServer = https.createServer(options, authServer);
httpsServer.listen(Number(PORT), () => {
    console.log(`Server start on PORT = ${PORT}`)
});