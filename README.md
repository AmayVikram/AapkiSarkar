# Aapki Sarkar

Aapki Sarkar is a web platform that enables citizens to participate in democratic decision-making by voting on government projects. Users can view various government initiatives, cast their votes, and engage with public infrastructure proposals.

## Features

- **User Authentication & Registration** (OTP verification via email)
- **Project Listing & Voting System**
- **Admin Dashboard for Project Management**
- **Secure Session Management**
- **Email Notifications for OTP Verification**

## Prerequisites

- **Node.js (v14 or higher)**
- **MongoDB** (for database storage)
- **Gmail account** (for sending OTP emails)

## Local Setup Instructions

### Clone the Repository

```sh
git clone https://github.com/Amay/aapki-sarkar.git
cd Aapki Sarkar
```

### Install Dependencies

```sh
npm install
```

### Environment Variables

Create a `.env` file in the root directory and add the following:

```env
EMAIL_USER=your_gmail_address@gmail.com
EMAIL_PASS=your_gmail_app_password
MONGO_URI=mongodb://localhost:27017/aapki-sarkar
SECRET_KEY=your_admin_secret_key
```

**Note:**

- For `EMAIL_PASS`, you need to generate an App Password from your Google Account.
- Choose a strong `SECRET_KEY` for admin authentication.

### Setup MongoDB

1. Install MongoDB locally if not already installed.
2. Start MongoDB service:
   ```sh
   mongod
   ```
3. The database will be created automatically when you run the application.

### Run the Application

```sh
npm start
```

**or**

```sh
node app.js
```

### Access the Website

Open your browser and navigate to:

```
http://localhost:3000
```

## Gmail Setup for OTP

1. **Go to Google Account Settings**
2. **Enable 2-Step Verification**
3. **Generate an App Password**
4. **Use the generated password in `EMAIL_PASS` environment variable**

## User Flow

### Admin Flow
1. **Signup** - Register as an admin.
2. **Login** - Authenticate using OTP verification.
3. **Dashboard** - Access the admin panel.
4. **Add Project** - Create new government projects.
5. **Projects** - View and manage listed projects.
6. **Vote** - Cast votes on listed projects.

### User Flow
1. **Signup** - Register as a user.
2. **Login** - Authenticate using OTP verification.
3. **Dashboard** - Access the user panel.
4. **Projects** - View available government projects.
5. **Vote** - Participate in voting.

## Website Link
[Visit Aapki Sarkar](http://localhost:3000)



