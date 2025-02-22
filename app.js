const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const app = express();
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

const secret_key = process.env.SECRET_KEY;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected"))
.catch((err) => console.log(err));

// Express session middleware
app.use(session({
    secret:'secret', 
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { secure: false, maxAge: 1000 * 60 * 60 } // 1-hour session
}));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Make session user available in all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

const User = require('./models/User'); // Import the User model

// Route to render the homepage
app.get('/', (req, res) => {
    res.render('home', { title: "Home"});
});

// Route for signup (GET)
app.get('/signup',  (req, res) => {
    res.render('signup', { title: "Sign Up", errorMessage: null ,newUser:null});
});

// Route for signup (POST)
app.post('/signup', async (req, res) => {
    const { name, email, mobile, password, admin_key, gender } = req.body;

    try {
        const existingUser =  await User.findOne({ $or: [{ mobile }, { email }] });
        if (existingUser) {
            return res.render('signup', { title: "Sign Up", errorMessage: "User already exists.",newUser:null });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        req.session.otp = otp; // Store OTP in session
        console.log("Generated OTP:", otp);

        // Send OTP to user's email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'OTP for Account Creation',
            text: `Your OTP for account creation is: ${otp}`
        };

        await transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending mail:", error);
                return res.render('signup', { title: "Sign Up", errorMessage: "Error sending OTP email.",newUser:null });
            }
            console.log('Email sent: ' + info.response);
        });

        // Create a new user object but don't save yet
        const newUser = new User({
            name,
            email,
            mobile,
            password,
            gender
        });

        const safeUser = {
            name,
            email,
            mobile,
            gender,
            password: "*".repeat(password.length),
            admin_key: admin_key ? "*".repeat(admin_key.length) : undefined
        };
        
        

        if (admin_key === secret_key) {
            newUser.role = 'admin';
        }

        req.session.newUser = newUser; // Store new user in session
        res.render('signup', { title: "Sign Up", errorMessage: " OTP sent to email.",newUser:safeUser||null });

    } catch (error) {
        console.error(error);
        res.render('signup', { title: "Sign Up", errorMessage: "Error creating account." });
    }
});

// Route for OTP verification
app.post('/verify-otp', async (req, res) => {
    const { otp } = req.body;
    console.log(req.session.otp)
    if (otp == req.session.otp) {
        const newUser = new User(req.session.newUser);

            // Save the user to the database
            await newUser.save(); // Save user to database

        // Clear session storage
        req.session.otp = null;
        req.session.newUser = null;
        

        res.render('login', { title: "Login", errorMessage: "Signup successful! Redirecting to login..." });
    } else {
        res.render('signup', { title: "Sign Up", errorMessage: "Invalid OTP.",newUser:req.session.newUser });
    }
});

// Route for login (GET)
app.get('/login', (req, res) => {
    res.render('login', { title: "Login", errorMessage: null });
});

// Route for login (POST)
app.post('/login', async (req, res) => {
    const { mobile, password } = req.body;

    try {
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.render('login', { title: "Login", errorMessage: "Invalid mobile number or password." });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('login', { title: "Login", errorMessage: "Invalid mobile number or password." });
        }

        req.session.user = user; // Store user in session
        res.redirect('/profile');

    } catch (error) {
        console.error(error);
        res.render('login', { title: "Login", errorMessage: "Error logging in. Please try again." });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.render('login', { title: "Login Page", errorMessage: "Please Login" });
    }
    if (req.session.user.role === 'user') {
        return res.render('signup', { title: "Login Page", errorMessage: "Please register as Admin",newUser:null });
    }
    res.render('dashboard', { title: "Dashboard", user: req.session.user });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login'); // Redirect to login page after logout
    });
});

const Project = require('./models/Projects'); // Import the schema

// Handle project submission
app.post('/projects/add', async (req, res) => {
    try {
        const { name, category, cost, description, deadline } = req.body;

        const newProject = new Project({ name, cost, description, category, deadline });
        await newProject.save();

        res.redirect('/projects');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error saving project');
    }
});

// Route to display all projects
app.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find();
        res.render('projects', { title: "Projects", projects });
    } catch (error) {
        res.status(500).send('Error fetching projects');
    }
});

// Vote for a project
app.post('/vote/:id', async (req, res) => {
    const { userId, voteType } = req.body;
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (project.votedBy.includes(userId)) {
            return res.status(400).json({ message: 'You have already voted' });
        }

        if (voteType === 'for') project.votesFor++;
        else if (voteType === 'against') project.votesAgainst++;

        project.votedBy.push(userId);
        await project.save();

        res.json({ votesFor: project.votesFor, votesAgainst: project.votesAgainst });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Profile route
app.get('/profile', async (req, res) => {
    if (!req.session.user) {
        return res.render('login', { title: "Login Page", errorMessage: "Please Login" });
    }

    const votedProjects = await Project.find({ votedBy: req.session.user._id });
    res.render('page', { votedProjects });
});

// Start server
app.listen(3000, () => {
    console.log(`Server is running on port 3000`);
});
