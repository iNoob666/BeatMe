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
const smsc = require('./external libs/smsc_api');

//https config
const { CertificateKey } = require('./config/keys');
const options = {
    key: fs.readFileSync('certificate/beatme_online.key', 'utf8'),
    cert: fs.readFileSync('certificate/beatme_online.full.crt', 'utf8'),
    passphrase: CertificateKey
};

smsc.test((err) => {
    if (err) return console.log('error: ' + err);
});

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
            return res.json({message: "Обновляющий токен пуст"});
        }
        const validToken = await Token.findOne({token: refreshToken});
        if(!validToken){
            return res.json({message: "Обновляющий токен не найден среди активных клиентов"});
        }
        jwt.verify(refreshToken, TokenSecret, (err, user) => {
            if(err){
                return res.json({message: "Обновляющий токен не прошел верификацию"});
            }
            const accessToken = generateAccessToken(user._id, user.roles);
            return res.json({accessToken: accessToken});
        });
    }
    catch (err){
        console.log(err);
        return res.json({message: "Не удалось обновить токен"});
    }
});

async function deleteSendCode(phoneNumb, hashPassCode){
    await PassCode.findOneAndDelete({phoneNumb: phoneNumb, hashPassCode: hashPassCode});
}

//Phone start
authServer.post('/phone', async (req, res) => {
    const { phoneNumb } = req.body;
    const user = await User.findOne({ 'socialAccount.identity': phoneNumb });
    if(!user){
        const existPassCode = await PassCode.findOneAndDelete({phoneNumb:phoneNumb});
        //Если пользователь не существует
        //проверка баланса
        smsc.get_balance(async function (balance, raw, err, code) {
            if (err){
                return console.log(err, 'code: '+code);
            }
            console.log(balance);
            //генерация кода
            const newPhoneNumb = phoneNumb.slice(1);
            const passCode = String(Math.floor(1000+Math.random()*9000));
            //отправка смс с кодом
            smsc.send_sms({
                phones : [newPhoneNumb],
                mes : passCode
            }, function (data, raw, err, code) {
                if (err){
                    //errors = true;
                    return console.log(err, 'code: '+code);
                }
                console.log(data); // object
                console.log(raw); // string in JSON format
            });

            const hashPassCode = bcrypt.hashSync(passCode, 10);
            const passcode = new PassCode({ phoneNumb: phoneNumb, hashPassCode: hashPassCode });
            await passcode.save();
            setTimeout(deleteSendCode, 1000 * 120, phoneNumb, hashPassCode);
            return res.json({ exist: false, phoneNumb: phoneNumb});
        });
        //должно быть все тут
    }
    else {
        return res.json({ exist: true, phoneNumb: phoneNumb });
    }
});

authServer.post('/passcode', async (req, res) => {
    const { phoneNumb, passCode } = req.body;
    const userPassCode = await  PassCode.findOne({ phoneNumb: phoneNumb });
    if(!userPassCode){
        return res.json({ message: "истек срок кода" });
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
        const user = await User.findOne({ 'socialAccount.identity': phoneNumb });
        if(!user){
            return res.json({message: `Пользователя с номером ${phoneNumb} не существует`});
        }
        const validPassword = bcrypt.compareSync(password, user.socialAccount.password);

        if(!validPassword){
            return res.json({message: "Введен неверный пароль"});
        }

        const accessToken = generateAccessToken(user._id, user.roles);
        const refreshToken = generateRefreshToken(user._id, user.roles);
        const newToken = new Token({token: refreshToken});
        await newToken.save();
        res.json({accessToken: accessToken, refreshToken: refreshToken, username: user.username })
    }
    catch (err){
        console.log(err);
        res.json({message: "Не удалось войти в профиль пользователя"});
    }
});

authServer.post('/register',[
    check("username", "invalid username")
        .trim()
        .isLength({ min: 8, max: 20 }).withMessage('Имя пользователя должно быть от 3 до 16 знаков')
        .matches(/^[A-Za-z0-9\s]+$/).withMessage('Имя пользователя должно быть на Английском языке'),
    check("confirmedPass")
        .trim()
        .isLength({ min: 8, max: 20 }).withMessage('Пароль должен быть от 6 до 32 знаков')
        .custom(async (confirmedPass,{req}) => {
            const { password } = req.body;
            if (confirmedPass !== password) {
                // trow error if passwords do not match
                throw new Error("Passwords don't match");
            }
            return true;
        }).withMessage('Пароли должны совпадать')
        //должен содержать минимум одну цифру, большую и малую буквы
        .matches(new RegExp('^(?=.[a-z])(?=.[A-Z])(?=.*[0-9])'))
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if(errors === null){
            return res.json(errors);
        }

        const { phoneNumb, username, password } = req.body;
        const candidate = await User.findOne({ username: username });
        if(candidate){
            return res.json({message: "Пользователь с таким именем уже существует"});
        }
        const hashPassword = bcrypt.hashSync(password, 10);
        const userRole = await Role.findOne({value: "USER"});
        const newUser = new User({ username: username, socialAccount: {type: "phone", identity: phoneNumb, password: hashPassword }, roles:[userRole.value]} );
        await newUser.save();
        return res.sendStatus(200);
    }
    catch (err){
        console.log(err);
        res.json({message: "Не удалось зарегестрировать пользователя"});
    }
});
//Phone finish

authServer.delete('/logout', async (req, res) => {
    const { refreshToken } = req.body;

    await Token.deleteOne({token: refreshToken}, (err, result) => {
        if(err) {
            return res.json({ message: err });
        }
        else {
            res.sendStatus(200);
        }
    });
});


//Social start
authServer.use('/auth', require('./routes/auth/google'));
authServer.use('/auth', require('./routes/auth/facebook'));
authServer.use('/auth', require('./routes/auth/vk'));
authServer.use('/auth', require('./routes/auth/instagram'));

authServer.put('/auth/createUsernameSocialMedia', async (req, res) => {
    const { identity, username, type } = req.body;
    const existUsername = await  User.findOne({ username: username });
    if(existUsername){
        return res.json({message: "Пользователь с таким именем уже существует"});
    }
    const userRole = await Role.findOne({value: "USER"});
    const newUser = new User({ username: username, socialAccount: { type: type , identity: identity}, roles:[userRole.value]});
    await newUser.save();
    
    const newUserID = User.findOne({ username: username});
    const accessToken = generateAccessToken(newUserID._id, newUserID.roles);
    const refreshToken = generateRefreshToken(newUserID._id, newUserID.roles);
    const newToken = new Token({token: refreshToken});
    await newToken.save();
    return res.json({accessToken: accessToken, refreshToken: refreshToken});
});
//Social finish

const httpsServer = https.createServer(options, authServer);
httpsServer.listen(Number(PORT), () => {
    console.log(`Server start on PORT = ${PORT}`)
});