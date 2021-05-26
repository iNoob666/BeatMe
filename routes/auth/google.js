const express = require('express');
const passport = require('passport');
const router = express.Router();

require('../../config/passport-google');

router.get('/google/callback', (req, res) =>{
    passport.authenticate('google', {
        successRedirect: '/auth/success',
        failureRedirect: '/auth/failure',
    });
});

module.exports = router;