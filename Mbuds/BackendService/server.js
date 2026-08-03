
require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const ConnectMongo = require('connect-mongo');
const authRoutes = require('./routes/authServiceroutes');
const userRoutes = require('./routes/userServiceRoutes');
const MongoStore = ConnectMongo.default || ConnectMongo.MongoStore || ConnectMongo;
const imagesDir = path.join(__dirname, 'images');

app.disable('x-powered-by');
app.use((req, res, next) => {
    const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const requestOrigin = req.headers.origin;

    if (requestOrigin === allowedOrigin) {
        res.header('Access-Control-Allow-Origin', requestOrigin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    return next();
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}
const cookieparser = require('cookie-parser');
app.use(cookieparser());
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    }
    else {
        cb(null, false);
    }
};
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));
app.use('/images', express.static(imagesDir));
const ConnectDB = require('./util/dataBase');
const session = require('express-session');
app.use(session({
    secret: process.env.SECRET_KEY,
    saveUninitialized: false,
    resave: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 600
    }),
    cookie: {
        maxAge: 600000,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
    }
}))
app.get('/', (req, res, next) => {
    return res.status(200).json({
        message: 'This health point is ok'
    })
})
app.use(authRoutes);
app.use(userRoutes);
app.use((error, req, res, next) => {
    console.error(error);
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Something went wrong. Please try again.'
            : error.message
    });
});
const PORT = process.env.PORT || 8080;
ConnectDB.then(() => {
    server.listen(PORT, () => {
        console.log(`Live at http://localhost:${PORT}`);
    })
}).catch((error) => {
    console.error(error);
    process.exit(1);
})

