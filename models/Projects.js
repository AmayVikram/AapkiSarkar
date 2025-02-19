const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    cost: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ["Technology", "Education", "Health", "Environment","Infrastructure"] // Ensuring only valid categories
    },
    deadline: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    votesFor: {
        type: Number,
        default: 0
    },
    votesAgainst: {
        type: Number,
        default: 0
    },
    votedBy: {
        type: [String],
        default: []
    }
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
