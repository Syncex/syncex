require('dotenv').config()

const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const Redis = require('ioredis')
const twilio = require('twilio')
const User = require('../models/UserModel')

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.2:6379');
redis.on('error', (error) => {
    console.error('Redis error:', error);
})

async function ensureRedis() {
    if (redis.status === 'wait') {
        await redis.connect()
    }
}

function normalizeEmail(value = '') {
    return value.trim().toLowerCase()
}

function apiError(res, status, message) {
    return res.status(status).json({ success: false, message })
}

async function sendOtp({ email, phonenumber, otpMethod, otp }) {
    if (otpMethod === 'Email') {
        if (!process.env.SG_KEY) {
            throw new Error('Email verification is not configured')
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: { user: 'apikey', pass: process.env.SG_KEY }
        })

        await transporter.sendMail({
            to: email,
            from: process.env.OTP_FROM_EMAIL || 'aravlead@gmail.com',
            subject: 'Your MoodBuds verification code',
            html: `<div style="font-family:sans-serif"><h2>Welcome to MoodBuds</h2><p>Your verification code is:</p><h1 style="letter-spacing:8px">${otp}</h1><p>This code expires in 10 minutes.</p></div>`
        })
        return
    }

    if (otpMethod === 'SMS') {
        if (!process.env.TWILIO_ID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NO) {
            throw new Error('SMS verification is not configured')
        }

        const client = twilio(process.env.TWILIO_ID, process.env.TWILIO_AUTH_TOKEN)
        const countryCode = process.env.DEFAULT_PHONE_COUNTRY_CODE || '+91'
        await client.messages.create({
            body: `${otp} is your MoodBuds verification code. It expires in 10 minutes.`,
            from: process.env.TWILIO_PHONE_NO,
            to: `${countryCode}${phonenumber}`
        })
        return
    }

    throw new Error('Choose Email or SMS for verification')
}

exports.getmoodbudsSignup = (req, res) => {
    return res.status(200).json({ success: true, message: 'Signup endpoint is ready' })
}

exports.postmoodbudssignup = async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim()
        const email = normalizeEmail(req.body.email)
        const phonenumber = String(req.body.phonenumber || '').replace(/\D/g, '')
        const otpMethod = req.body.otpMethod

        if (!name || !email || !phonenumber || !otpMethod) {
            return apiError(res, 400, 'Name, email, phone number, and OTP method are required')
        }

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return apiError(res, 400, 'Enter a valid email address')
        }

        if (!/^\d{10,15}$/.test(phonenumber)) {
            return apiError(res, 400, 'Enter a valid phone number')
        }

        const existingUser = await User.findOne({
            $or: [{ userEmail: email }, { userPhone: phonenumber }]
        }).lean()

        if (existingUser) {
            return apiError(res, 409, 'An account already exists with this email or phone number')
        }

        await ensureRedis()
        const otp = String(crypto.randomInt(100000, 1000000))
        const token = crypto.randomUUID()
        const hashedOtp = await bcrypt.hash(otp, 12)

        await redis.hset(token, {
            name,
            email,
            phone: phonenumber,
            savedOtp: hashedOtp,
            attemptsleft: '3'
        })
        await redis.expire(token, 600)

        try {
            await sendOtp({ email, phonenumber, otpMethod, otp })
        } catch (error) {
            await redis.del(token)
            return apiError(res, 503, error.message)
        }

        req.session.signupToken = token
        return req.session.save((error) => {
            if (error) return next(error)
            return res.status(200).json({
                success: true,
                message: `Verification code sent via ${otpMethod}`
            })
        })
    } catch (error) {
        return next(error)
    }
}

exports.getverifyotp = (req, res) => {
    return res.status(200).json({ success: true, message: 'OTP endpoint is ready' })
}

exports.postverifyotp = async (req, res, next) => {
    try {
        const otp = String(req.body.otp || '').trim()
        const token = req.session.signupToken

        if (!/^\d{6}$/.test(otp)) {
            return apiError(res, 400, 'Enter the complete 6-digit code')
        }

        if (!token) {
            return apiError(res, 401, 'Your signup session expired. Please start again')
        }

        await ensureRedis()
        const signupData = await redis.hgetall(token)
        if (!signupData.savedOtp) {
            delete req.session.signupToken
            return apiError(res, 410, 'Your verification code expired. Please request a new one')
        }

        const isValid = await bcrypt.compare(otp, signupData.savedOtp)
        if (!isValid) {
            const attemptsLeft = await redis.hincrby(token, 'attemptsleft', -1)
            if (attemptsLeft <= 0) {
                await redis.del(token)
                delete req.session.signupToken
                return apiError(res, 429, 'Too many incorrect attempts. Please start again')
            }
            return apiError(res, 400, `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining`)
        }

        req.session.pendingProfile = {
            name: signupData.name,
            email: signupData.email,
            phone: signupData.phone
        }
        delete req.session.signupToken
        await redis.del(token)

        return req.session.save((error) => {
            if (error) return next(error)
            return res.status(200).json({ success: true, message: 'Code verified' })
        })
    } catch (error) {
        return next(error)
    }
}

exports.getProfileCreation = (req, res) => {
    if (!req.session.pendingProfile) {
        return apiError(res, 401, 'Verify your contact details before creating a profile')
    }
    return res.status(200).json({ success: true, message: 'Profile creation endpoint is ready' })
}

exports.postProfileCreation = async (req, res, next) => {
    try {
        const pendingProfile = req.session.pendingProfile
        const nickname = String(req.body.nickname || '').trim()
        const password = String(req.body.password || '')

        if (!pendingProfile) {
            return apiError(res, 401, 'Your verified signup session expired. Please start again')
        }
        if (!nickname || password.length < 8) {
            return apiError(res, 400, 'A nickname and password of at least 8 characters are required')
        }

        const existingUser = await User.findOne({
            $or: [
                { userEmail: pendingProfile.email },
                { userPhone: pendingProfile.phone }
            ]
        }).lean()
        if (existingUser) {
            delete req.session.pendingProfile
            return apiError(res, 409, 'This account has already been created')
        }

        const hashedPassword = await bcrypt.hash(password, 12)
        const imagePath = req.file ? `/images/${req.file.filename}` : '/images/default-avatar.svg'

        const user = await User.create({
            userName: pendingProfile.name,
            userNickName: nickname,
            userEmail: pendingProfile.email,
            userPhone: pendingProfile.phone,
            userPassword: hashedPassword,
            userImage: imagePath
        })

        delete req.session.pendingProfile
        return req.session.save((error) => {
            if (error) return next(error)
            return res.status(201).json({
                success: true,
                message: 'Your MoodBuds account is ready',
                user: {
                    id: user._id,
                    name: user.userName,
                    nickname: user.userNickName,
                    email: user.userEmail,
                    image: user.userImage
                }
            })
        })
    } catch (error) {
        return next(error)
    }
}

exports.getmoodBudsSignin = (req, res) => {
    return res.status(200).json({ success: true, message: 'Signin endpoint is ready' })
}

exports.postmoodBudsSignin = async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email)
        const password = String(req.body.password || '')

        if (!email || !password) {
            return apiError(res, 400, 'Email and password are required')
        }

        const user = await User.findOne({ userEmail: email })
        if (!user || !(await bcrypt.compare(password, user.userPassword))) {
            return apiError(res, 401, 'Incorrect email or password')
        }

        return req.session.regenerate((error) => {
            if (error) return next(error)

            req.session.isLoggedIn = true
            req.session.userId = String(user._id)
            req.session.userName = user.userName
            req.session.role = 'user'

            if (process.env.JWT_USER_SECRET) {
                const token = jwt.sign(
                    { userId: user._id, user: user.userName, role: 'user' },
                    process.env.JWT_USER_SECRET,
                    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
                )
                res.cookie('user_jwt', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 3600000,
                    path: '/'
                })
            }

            return req.session.save((saveError) => {
                if (saveError) return next(saveError)
                return res.status(200).json({
                    success: true,
                    message: 'Signed in successfully',
                    user: {
                        id: user._id,
                        name: user.userName,
                        nickname: user.userNickName,
                        email: user.userEmail,
                    }
                })
            })
        })
    } catch (error) {
        return next(error)
    }
}
exports.postmoodBudsSingin = exports.postmoodBudsSignin

exports.verifyJwt = (req, res, next) => {
    const token = req.cookies.user_jwt
    if (!token || !process.env.JWT_USER_SECRET) {
        return apiError(res, 401, 'Please sign in to continue')
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_USER_SECRET)
        if (decoded.role !== 'user') {
            return apiError(res, 403, 'You do not have access to this resource')
        }
        req.session.userName = decoded.user
        req.session.userId = decoded.userId
        req.session.role = decoded.role
        req.session.isLoggedIn = true
        return next()
    } catch {
        return apiError(res, 401, 'Your session expired. Please sign in again');
    }
}

exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.isLoggedIn && req.session.role === 'user') {
        return next()
    }
    console.log('Not Authenticated');
    return apiError(res, 401, 'Please sign in to continue')
}
