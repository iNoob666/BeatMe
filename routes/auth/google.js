const express = require('express');
const passport = require('passport');
const router = express.Router();

require('../../config/passport-google');

router.get('/google/callback', (req, res) =>{
    passport.authenticate('google', {
        successRedirect: '/success',
        failureRedirect: '/failure',
    });
});

router.get('/success', (req, res) =>{
    console.log("success");
    res.sendStatus(200);
});

router.get('/failure', (req, res) =>{
    res.sendStatus(401);
});

module.exports = router;