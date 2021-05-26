//packages
const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

//https config
const { CertificateKey } = require('./config/keys');
const options = {
    key: fs.readFileSync('certificate/key.pem', 'utf8'),
    cert: fs.readFileSync('certificate/cert.pem', 'utf8'),
    passphrase: CertificateKey
};

//app initializing
const app = express();
app.use(cors())
const PORT = process.env.SERVER_PORT || 9500;

//Body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', require('./routes/privacy'));

const httpsServer = https.createServer(options, app);
httpsServer.listen(Number(PORT), () => {
    console.log(`Server start on PORT = ${PORT}`)
});