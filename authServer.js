//packages
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const https = require('https');
const fs = require('fs');

//https config
const options = {
    key: fs.readFileSync('certificate/key.pem', 'utf8'),
    cert: fs.readFileSync('certificate/cert.pem', 'utf8')
};

//DB schemas
const User = require('./models/user');
const Token = require('./models/token');
const Role = require('./models/role');

//jwt secret key
const { TokenSecret } = require('./config/keys');

//app initializing
const authServer = express();
const PORT = process.env.PORT || 9000;

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
        const refreshToken = req.headers.authorization.split(' ')[1];
        if(!refreshToken){
            return res.sendStatus(401).json({message: "Обновляющий токен пуст"});
        }
        const validToken = await Token.findOne({token: refreshToken});
        if(!validToken){
            return res.sendStatus(401).json({message: "Обновляющий токен не найден среди активных клиентов"});
        }
        jwt.verify(refreshToken, tokenSecret, (err, user) => {
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

authServer.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username: username })
        if(!user){
            return res.sendStatus(401).json({message: `Пользователя с именем ${username} не существует`})
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

authServer.post('/register',
    check('username', 'Имя пользователя не может быть пустым').notEmpty(),
    check('password', 'Пароль должен быть больше 6 и меньше 32 символов').isLength({min: 6, max: 32})
, async (req, res) => {
    try {
        const errors = validationResult(req);
        if(!errors){
            return res.sendStatus(401).json({message: 'Ошибки заполнения полей'});
        }
        const { username, password } = req.body;
        const candidate = await User.findOne({username});
        if(candidate){
            return res.sendStatus(401).json({message: "Пользователь с таким именем уже существует"});
        }
        const hashPassword = bcrypt.hashSync(password, 10);
        const userRole = await Role.findOne({value: "USER"});
        const newUser = new User({username, password: hashPassword, roles:[userRole.value]});
        await newUser.save();
        return res.json({message: "Пользователь успешно зарегистрирован"});
    }
    catch (err){
        console.log(err);
        res.sendStatus(401).json({message: "Не удалось зарегестрировать пользователя"});
    }
});

authServer.delete('/logout', (req, res) => {

});


const start = () => {
    try {
        const httpsServer = https.createServer(options, authServer);
	httpsServer.listen(Number(PORT));
    }
    catch (e){
        console.log(e);
    }
}

start();
