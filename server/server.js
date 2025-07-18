// server.js
// This server handles file uploads and downloads, and implements a basic image-based authentication system.

// Import necessary modules
const express = require('express'); // Web framework for Node.js
const multer = require('multer');   // Middleware for handling multipart/form-data (file uploads)
const path = require('path');     // Utility for working with file and directory paths
const fs = require('fs');         // File system module for reading/writing files
const cors = require('cors');     // Middleware to enable Cross-Origin Resource Sharing

const app = express();
const PORT = 3001; // Port the server will listen on

// --- CORS Configuration ---
// Configure CORS to allow requests from your deployed client
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://drop.harrison-martin.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// --- Body Parsers ---
// Parse JSON bodies (for login requests)
app.use(express.json());
// Parse URL-encoded bodies (for form submissions, though not strictly needed for this example)
app.use(express.urlencoded({ extended: true }));

// --- File Storage Configuration ---
// Define the directory where uploaded files will be stored.
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Create the uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Configure Multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Set the destination directory for uploaded files
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Set the filename for uploaded files.
        // Here, we use the original filename, but you might want to add a timestamp
        // or a unique ID to prevent name collisions.
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });
// --- Simple JSON Database ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const PASSWORDS_FILE = path.join(DATA_DIR, 'passwords.json');
function readData(file) {
    if (!fs.existsSync(file)) return {};
    try { return JSON.parse(fs.readFileSync(file)); } catch (e) {
        console.error(`Error reading data from ${file}:`, e);
        return {};
    }
}
function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- Image-Based Password System ---
// This is a simplified image-based password.
// In a real application, this would be much more complex (e.g., hashing the sequence,
// storing it securely, and using more robust session management).

// The secret image sequence (indices from 0 to 8, representing a 3x3 grid)
// This is the sequence the user must click to log in.
const CORRECT_IMAGE_SEQUENCE = [2, 6, 4, 8]; // Example: top-left, center, bottom-right, top-right
// Max attempts for image login
const MAX_IMAGE_LOGIN_ATTEMPTS = parseInt(process.env.MAX_IMAGE_LOGIN_ATTEMPTS) || 5;
const imageLoginAttempts = {};

// A very basic "session" management. In a real app, use JWTs or proper session middleware.
const authenticatedUsers = new Set(); // Stores user IDs (or simple tokens) of authenticated clients

// --- Admin Password System ---
// Use bcrypt for hashing and comparison
const bcrypt = require('bcrypt');
// Default admin password (override via env vars)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
// Hashed admin password (or provide via env)
// Note: If ADMIN_PASSWORD_HASH is not set via env, it will be re-hashed on every server restart
// which means the 'admin' password will only work if the server hasn't restarted since the hash was generated.
// For production, always set ADMIN_PASSWORD_HASH as an environment variable with a pre-computed hash.
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(ADMIN_PASSWORD, 10);
// Max attempts for admin password
const MAX_ADMIN_PASSWORD_ATTEMPTS = parseInt(process.env.MAX_ADMIN_PASSWORD_ATTEMPTS) || 5;
const adminPasswordAttempts = {};

// Middleware to check if the user is authenticated
function authenticateToken(req, res, next) {
    // For this example, we'll check for a simple 'authorization' header.
    // In a real app, this would be a JWT or session cookie.
    // Allow token from Authorization header or query parameter
    const token = req.headers['authorization'] || req.query.token;

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
    }

    // A very basic token check. In production, validate a JWT.
    if (authenticatedUsers.has(token)) {
        req.user = { id: token }; // Attach user info to the request
        next(); // Proceed to the next middleware/route handler
    } else {
        res.status(403).json({ message: 'Invalid or expired token' });
    }
}

// --- Endpoints ---

// Simple test endpoint to verify CORS is working
app.get('/test', (req, res) => {
    res.json({ message: 'CORS is working!', origin: req.headers.origin });
});

/**
 * @api {post} /login User Login
 * @apiName Login
 * @apiGroup Auth
 * @apiParam {Number[]} imageSequence The sequence of clicked image indices (0-8).
 * @apiSuccess {String} message Success message.
 * @apiSuccess {String} token A simple authentication token.
 * @apiError {String} message Error message if login fails.
 */
app.post('/login', (req, res) => {
    const clientKey = req.ip;
    // Initialize attempt count
    if (!imageLoginAttempts[clientKey]) imageLoginAttempts[clientKey] = 0;
    // Too many attempts
    if (imageLoginAttempts[clientKey] >= MAX_IMAGE_LOGIN_ATTEMPTS) {
        return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
    }
    const { imageSequence } = req.body;

    if (!imageSequence || !Array.isArray(imageSequence)) {
        return res.status(400).json({ message: 'Image sequence is required and must be an array.' });
    }

    // Compare the received sequence with the correct sequence
    const isCorrect = imageSequence.length === CORRECT_IMAGE_SEQUENCE.length &&
                     imageSequence.every((value, index) => value === CORRECT_IMAGE_SEQUENCE[index]);

    if (isCorrect) {
        // reset attempts on success
        imageLoginAttempts[clientKey] = 0;
        // Use deterministic token based on image sequence for persistence
        const token = `user_${imageSequence.join('_')}`;
        authenticatedUsers.add(token);
        console.log(`User logged in. Token: ${token}`);
        res.json({ message: 'Login successful!', token });
    } else {
        imageLoginAttempts[clientKey]++; // Increment attempts on failure
        res.status(401).json({ message: 'Incorrect image sequence.' });
    }
});

/**
 * @api {post} /upload Upload File
 * @apiName UploadFile
 * @apiGroup Files
 * @apiHeader {String} Authorization User's authentication token.
 * @apiParam {File} file The file to upload.
 * @apiSuccess {String} message Success message.
 * @apiSuccess {String} filename The name of the uploaded file.
 * @apiError {String} message Error message if upload fails or not authenticated.
 */
app.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    console.log(`File uploaded: ${req.file.originalname} by user ${req.user.id}`);
    res.json({ message: 'File uploaded successfully!', filename: req.file.originalname });
});

/**
 * @api {get} /download/:filename Download File
 * @apiName DownloadFile
 * @apiGroup Files
 * @apiHeader {String} Authorization User's authentication token.
 * @apiParam {String} filename The name of the file to download.
 * @apiSuccess {File} file The requested file.
 * @apiError {String} message Error message if file not found or not authenticated.
 */
app.get('/download/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File not found: ${filename}`);
            return res.status(404).json({ message: 'File not found.' });
        }
        // Send the file
        res.download(filePath, (err) => {
            if (err) {
                console.error(`Error downloading file ${filename}:`, err);
                // Check if headers were already sent to avoid errors
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Error downloading file.' });
                }
            } else {
                console.log(`File downloaded: ${filename} by user ${req.user.id}`);
            }
        });
    });
});

/**
 * @api {get} /files List Available Files
 * @apiName ListFiles
 * @apiGroup Files
 * @apiHeader {String} Authorization User's authentication token.
 * @apiSuccess {String[]} files List of available filenames.
 * @apiError {String} message Error message if not authenticated.
 */
app.get('/files', authenticateToken, (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) {
            console.error('Error listing files:', err);
            return res.status(500).json({ message: 'Error listing files.' });
        }
        // Filter out any hidden files or directories if necessary
        const fileNames = files.filter(name => fs.statSync(path.join(UPLOAD_DIR, name)).isFile());
        res.json({ files: fileNames });
    });
});

// --- Notes Endpoints (JSON file DB) ---
app.get('/notes', authenticateToken, (req, res) => {
    const allNotes = readData(NOTES_FILE);
    // Return user-specific notes
    const userNotes = allNotes[req.user.id] || [];
    res.json({ notes: userNotes });
});

app.post('/notes', authenticateToken, (req, res) => {
    const { content } = req.body;
    if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content is required and must be a string.' });
    }
    const allNotes = readData(NOTES_FILE);
    const entry = { id: Date.now().toString(), content };
    if (!allNotes[req.user.id]) allNotes[req.user.id] = [];
    allNotes[req.user.id].push(entry);
    writeData(NOTES_FILE, allNotes);
    res.json({ note: entry });
});

app.put('/notes/:id', authenticateToken, (req, res) => {
    const { content } = req.body;
    if (typeof content !== 'string') {
        return res.status(400).json({ message: 'Content is required and must be a string.' });
    }
    const allNotes = readData(NOTES_FILE);
    const list = allNotes[req.user.id] || [];
    const note = list.find(n => n.id === req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found.' });
    note.content = content;
    writeData(NOTES_FILE, allNotes);
    res.json({ note });
});

app.delete('/notes/:id', authenticateToken, (req, res) => {
    const allNotes = readData(NOTES_FILE);
    let list = allNotes[req.user.id] || [];
    const idx = list.findIndex(n => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Note not found.' });
    list.splice(idx, 1);
    allNotes[req.user.id] = list;
    writeData(NOTES_FILE, allNotes);
    res.json({ message: 'Note deleted.' });
});

// --- Passwords Endpoints (JSON file DB) ---
app.get('/passwords', authenticateToken, (req, res) => {
    const allPass = readData(PASSWORDS_FILE);
    const passwords = allPass[req.user.id] || [];
    res.json({ passwords });
});

// --- Image Preview Endpoint ---
// Serve images directly for previewing in browser
app.get('/images/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return res.status(404).json({ message: 'Image not found.' });
        res.sendFile(filePath, (err) => {
            if (err) res.status(500).json({ message: 'Error sending image.' });
        });
    });
});

// --- Admin Password Verification Endpoint ---
/**
 * @api {post} /admin/check-password Verify admin password
 * @apiName CheckAdminPassword
 * @apiGroup Admin
 * @apiHeader {String} Authorization User's auth token.
 * @apiParam {String} password Admin password to verify.
 * @apiSuccess {Boolean} success True if password is correct.
 * @apiError {String} message Error message if verification fails.
 */
app.post('/admin/check-password', authenticateToken, async (req, res) => {
    const clientKey = req.user.id;
    // Initialize attempt count
    if (!adminPasswordAttempts[clientKey]) adminPasswordAttempts[clientKey] = 0;
    // Too many attempts
    if (adminPasswordAttempts[clientKey] >= MAX_ADMIN_PASSWORD_ATTEMPTS) {
        return res.status(429).json({ message: 'Too many admin password attempts. Please try again later.' });
    }
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ message: 'Password is required.' });
    }
    try {
        const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
        if (match) {
            // reset attempts on success
            adminPasswordAttempts[clientKey] = 0;
            return res.json({ success: true });
        } else {
            // increment failure count
            adminPasswordAttempts[clientKey]++;
            return res.status(403).json({ message: 'Incorrect admin password.' });
        }
    } catch (err) {
        console.error('Admin password check error:', err);
        res.status(500).json({ message: 'Error verifying password.' });
    }
});

app.post('/passwords', authenticateToken, (req, res) => {
    const { name, link, username, password } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }
    const allPass = readData(PASSWORDS_FILE);
    const entry = { id: Date.now().toString(), name, link: link || '', username, password };
    if (!allPass[req.user.id]) allPass[req.user.id] = [];
    allPass[req.user.id].push(entry);
    writeData(PASSWORDS_FILE, allPass);
    res.json({ password: entry });
});

app.delete('/passwords/:id', authenticateToken, (req, res) => {
    const allPass = readData(PASSWORDS_FILE);
    let list = allPass[req.user.id] || [];
    const idx = list.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Password not found.' });
    list.splice(idx, 1);
    allPass[req.user.id] = list;
    writeData(PASSWORDS_FILE, allPass);
    res.json({ message: 'Password deleted.' });
});
// --- End of Passwords Endpoints ---

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Down Drop Server running on http://localhost:${PORT}`);
    console.log(`Uploads directory: ${UPLOAD_DIR}`);
    console.log(`Remember the image sequence for login: ${CORRECT_IMAGE_SEQUENCE.join(', ')}`);
});
