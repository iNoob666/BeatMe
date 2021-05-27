const passport = require('passport');
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const mongoose = require('mongoose');
const User = require('../models/user');

const GOOGLE_CLIENT_ID = '745917081582-uu9ec4jggjrpmgntbsjklsfd5gqkpkon.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'DMt9P0I9hYanYomSZAANTvZT';

passport.use(new GoogleStrategy({
        clientID:     GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "https://beatme.online:9000/auth/google/callback",
        passReqToCallback: true
    },
    function(request, accessToken, refreshToken, profile, done) {
        console.log(profile);
        console.log(accessToken);
        console.log(refreshToken);
        return done(err, profile);
    }
));

passport.serializeUser((user, done) =>{
   done(null, user);
});

passport.deserializeUser((user, done) =>{
    done(null, user);
});