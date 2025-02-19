const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const app = express();
require('dotenv').config();





const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

const secret_key= process.env.SECRET_KEY

// In-memory storage for OTPs and temporary user data
const tempStorage = {
    otp: null,
    newUser: null,
    loggedInUser: null
};

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB connected"))
.catch((err) => console.log(err));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    res.locals.user = tempStorage.loggedInUser || null; // Make `user` available in all views
    next();
});

// Route to render the homepage
app.get('/', (req, res) => {
    res.render('login', { title: "Login", errorMessage: null}); // Passing data to EJS
});

const User = require('./models/User'); // Import the User model




// Route for signup (GET)
app.get('/signup', (req, res) => {
    res.render('signup', { title: "Sign Up", errorMessage: null});
});

// Route for signup (POST)
app.post('/signup', async (req, res) => {
    const { name, email, mobile, password, admin_key } = req.body;
    console.log(req.body);

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ mobile });
        if (existingUser) {
            return res.render('signup', { title: "Sign Up", errorMessage: "User already exists." });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000); 

        // Store OTP in temporary storage
        tempStorage.otp = otp;
        console.log("Generated OTP:", otp);

        // Send OTP to user's email
        const mailOptions = {
            from: 'singhamay120@gmail.com', // Replace with your email
            to: email,
            subject: 'OTP for Account Creation',
            text: `Your OTP for account creation is: ${otp}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending mail:", error);
                return res.render('signup', { title: "Sign Up", errorMessage: "Error sending OTP email."});
            }
            console.log('Email sent: ' + info.response);
        });

        // Create a new user but don't save yet (save after OTP verification)
        const newUser = new User({
            name,
            email,
            mobile,
            password
        });

        if (admin_key === secret_key) {
            newUser.role = 'admin';
            console.log('Admin signup detected');
        }

        // Store the new user temporarily
        tempStorage.newUser = newUser;


    } catch (error) {
        console.error(error);
        return res.render('signup', { title: "Sign Up", errorMessage: "Error creating account." });
    }
});

// Route for OTP verification
app.post('/verify-otp', async (req, res) => {
    console.log("OTP Verification Route Hit!");
    console.log("Received Data:", req.body);

    const { otp } = req.body;

    if (otp == tempStorage.otp) {
        // OTP is correct, save the user to the database
        await tempStorage.newUser.save();

        // Clear temporary storage
        tempStorage.otp = null;
        tempStorage.newUser = null;

        res.render('login', { title: "Login", errorMessage:"Signup successful! Redirecting to login..." });
        
    } else {
        return res.render('signup', { title: "Sign Up", errorMessage: "Invalid OTP." });
    }
});


// Route for login (GET)
app.get('/login', (req, res) => {
    res.render('login', { title: "Login Page", errorMessage: null });
});

// Route for login (POST)
app.post('/login', async (req, res) => {
    const { mobile, password } = req.body;

    try {
        // Find user by mobile number
        const user = await User.findOne({ mobile });
        if (!user) {
            return res.render('login', { title: "Login Page", errorMessage: "Invalid mobile number or password." });
        }

        // Compare entered password with stored hashed password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('login', { title: "Login Page", errorMessage: "Invalid mobile number or password." });
        }

        // Store the user in temporary storage
        tempStorage.loggedInUser = user;
        console.log("login success")
        console.log(tempStorage.loggedInUser)

        
        return res.redirect(user.role === 'admin' ? '/dashboard' : '/projects');

    } catch (error) {
        console.error(error);
        return res.render('login', { title: "Login Page", errorMessage: "Error logging in. Please try again." });
    }
});


app.get('/dashboard', (req, res) => {
    if (!tempStorage.loggedInUser) {
        return res.render('login', { title: "Login Page", errorMessage: "Please Login" });
    }
    if(tempStorage.loggedInUser.role === 'user'){
        return res.render('signup', { title: "Login Page", errorMessage: "Please register as Admin" });
    }
    res.render('dashboard', { title: "Dashboard", user: tempStorage.loggedInUser });
});

// Logout route
app.get('/logout', (req, res) => {
    // Clear the logged-in user from temporary storage
    tempStorage.loggedInUser = null;
    res.redirect('/login'); // Redirect to login page after logout
});

const Project = require('./models/Projects'); // Import the schema

// Handle project submission
app.post('/projects/add', async (req, res) => {
    try {
        const { name, cost, description } = req.body;

        // Create a new project
        const newProject = new Project({ name, cost, description });

        // Save to database
        await newProject.save();

        res.redirect('/projects'); // Redirect to projects list page
    } catch (error) {
        res.status(500).send('Error saving project');
    }
});


// Route to display all projects
app.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find(); // Fetch all projects from the database
        res.render('projects', { title: "Projects", projects }); // Render projects.ejs with data
    } catch (error) {
        res.status(500).send('Error fetching projects');
    }
});

app.post('/vote/:id', async (req, res) => {
    const { userId, voteType } = req.body; // userId and voteType (for or against)
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const user = await User.findById(userId);
        if (!user) {
        return res.status(404).json({ message: 'User not found' });
        }

        // Check if user has already voted
        if (project.votedBy.includes(userId)) {
            return res.status(400).json({ message: 'You have already voted on this project' });
        }

        // Update vote count
        if (voteType === 'for') {
            project.votesFor += 1;
        } else if (voteType === 'against') {
            project.votesAgainst += 1;
        } else {
            return res.status(400).json({ message: 'Invalid vote type' });
        }

        // Add user to voted list
        project.votedBy.push(userId)
        await project.save();

        res.json({ votesFor: project.votesFor, votesAgainst: project.votesAgainst });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/delete/project/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;

        // Check if the project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Delete the project
        await Project.findByIdAndDelete(projectId);

        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});





app.listen(3000, () => {
    console.log(`Server is running on 3000`);
});