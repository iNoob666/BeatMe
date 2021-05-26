const express = require('express');
const router = express.Router();
const path = require('path');

router.use(express.static('public'));

router.get('/privacy_policy', (req, res) => {
    res.sendFile(path.join(__dirname, '/../views/privacy_policy.html'));
});

router.get('/public_terms_of_service', (req, res) => {
    res.sendFile(path.join(__dirname, '/../views/terms_of_services.html'));
});

module.exports = router;