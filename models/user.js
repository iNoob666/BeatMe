const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
    },
    socialAccount:
        {
            type: {
                type: String,
                required: true
            },
            identity: {
                type: String,
                unique: true,
            },
            password: {
                type: String,
                required: () => {
                    return this.type === "phone";
                }
            }
        },
    roles: [{
        type: String,
        ref: 'Role'
    }],
    date: {
        type: Date,
        default: Date.now
    },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;