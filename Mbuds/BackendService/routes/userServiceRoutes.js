const express = require('express');
require('dotenv').config();
const authController = require('../controllers/authService');
const userController = require('../controllers/userService');
const router = express.Router();
router.get('/moodbudsv1/dashboard', authController.isAuthenticated, authController.verifyJwt, userController.getUserDashboard);
router.post('/moodbudsv1/bluetooth', authController.isAuthenticated, authController.verifyJwt, userController.postbluetoothdata);
module.exports = router;