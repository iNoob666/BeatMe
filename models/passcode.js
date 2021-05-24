const mongoose = require('mongoose');

const PassCodeSchema = new mongoose.Schema({
    phoneNumb: {
        type: String,
        unique: true,
        required: true
    },
    hashPassCode: {
        type: String,
        required: true
    }
});

const PassCode = mongoose.model('PassCode', PassCodeSchema);

module.exports = PassCode;