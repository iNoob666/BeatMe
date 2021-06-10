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
    key: fs.readFileSync('certificate/beatme_online.key', 'utf8'),
    cert: fs.readFileSync('certificate/beatme_online.full.crt', 'utf8'),
    passphrase: CertificateKey
};

//app initializing
const app = express();
app.use(cors())
const PORT = process.env.SERVER_PORT || 443;

//Body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', require('./routes/privacy'));

app.get('/', (req, res) => {
    return res.send('').sendStatus(200);
})

const httpsServer = https.createServer(options, app);
httpsServer.listen(Number(PORT), () => {
    console.log(`Server start on PORT = ${PORT}`)
});