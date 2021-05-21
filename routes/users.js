const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Nexmo = require('nexmo');
const jwt = require('jsonwebtoken');

//DB user model
const User = require('../models/user');

//Phone check
router.get('/phone', (req, res) => {
    const phone = req.body.phone;
    User.findOne({ phone: phone })
        .then(user => {
            if(user){
                //User exist
                res.json("exist: true")
            }
            else {
                //Send message
                res.json("exist: false")
                const nexmo = new Nexmo({
                    apiKey: 'abcd1234',
                    apiSecret: 'abcdef0123456789',
                });
                const from = 'Beat Me';
                const text = Math.floor(Math.random() * 10000).toString();
                nexmo.message.sendSms(from, phone, text, (err, result) => {
                    if (err) {
                        console.log("ERROR", err);
                    }
                    else{
                        console.log("SUCCESS", result);
                    }
                });
            }
        })
})

//Phone Handle
router.post('/phone', (req, res) => {
    const passCode = req.body;
})

//Register Handle
router.post('/register', (req, res) => {
    const { username, password } = req.body;

    let errors = [];

    //Check required fields
    if(!name || !password){
        errors.push({ msg: 'Please fill all fields' });
    }

    //Check pass length
    if(password.length < 6 || password.length > 32){
        errors.push({ msg: 'Password should be from 6 to 32 characters' });
    }

    if(errors.length > 0){
        res.json({
            errors,
            username,
            password
        });
    }else {
        //Validation passed
        User.findOne({ username: username })
            .then(user => {
                if(user){
                    //User exists
                    errors.push({ msg: 'Email is already registered' });
                    res.json({
                        errors,
                        username,
                        password
                    });
                }else {
                    const newUser = new User({
                        username,
                        password
                    });
                    bcrypt.genSalt(10,(err, salt) =>
                        bcrypt.hash(newUser.password, salt, (err, hash) => {
                            if(err) throw err;
                            //Set password to hashed
                            newUser.password = hash;
                            //Save user
                            newUser.save()
                                .then(user => {
                                    req.flash('success_msg', 'You are registered now and can log in');
                                    res.redirect('/users/login');
                                })
                                .catch(err => console.log(err))
                        }));
                }
            });
    }
});

//Login handle
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/profile',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res, next);
});

//Logout handle
router.get('/logout', (req, res) => {
    req.logout();
    req.flash('success_msg', 'You logout');
    res.redirect('/');
});

module.exports = router;