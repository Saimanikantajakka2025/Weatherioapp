const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// -------------------- MongoDB Connection -------------------- //
const MONGO_URI = "mongodb+srv://corpgroupbeintern_db_user:wIUfjZFqCPO0JvIh@cluster0.ve8fl4r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0" ;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// -------------------- Schemas & Models -------------------- //
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const overrideSchema = new mongoose.Schema({
  lat: String,
  lon: String,
  date: String,
  newValues: Object,
  updatedAt: String,
  updatedBy: String,  // user's email
  version: Number,
  active: Boolean
});
const Override = mongoose.model('Override', overrideSchema);
async function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

// -------------------- Database Utility Functions -------------------- //
async function getLatestOverride(lat, lon, date, userEmail) {
  return await Override.findOne({ lat, lon, date, active: true, updatedBy: userEmail })
    .sort({ version: -1 })
    .exec();
}

async function addOverride(lat, lon, date, values, userEmail) {
  const latest = await Override.findOne({ lat, lon, date, updatedBy: userEmail })
    .sort({ version: -1 }).exec();

  const newVersion = latest ? latest.version + 1 : 1;
  await Override.updateMany({ lat, lon, date, updatedBy: userEmail }, { $set: { active: false } });

  const newOverride = new Override({
    lat,
    lon,
    date,
    newValues: values,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
    version: newVersion,
    active: true,
  });

  return await newOverride.save();
}

async function removeOverride(lat, lon, date, userEmail) {
  const latest = await Override.findOneAndUpdate(
    { lat, lon, date, active: true, updatedBy: userEmail },
    { $set: { active: false } },
    { new: true }
  );
  return latest;
}

// -------------------- MIME Mapping -------------------- //
const MIME_MAP = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

// -------------------- HTTP Server -------------------- //
const server = http.createServer(async (req, res) => {
  const method = req.method;
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS for APIs
  if (pathname.startsWith('/override') || pathname === '/login' || pathname === '/health') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
  }

  // -------------------- Health Check -------------------- //
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
    return;
  }

  if (pathname === '/register' && method === 'POST') {
    try {
      const { email, password } = await parseJSONBody(req);
      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Email and password are required' }));
        return;
      }

      const existing = await User.findOne({ email });
      if (existing) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'User already exists' }));
        return;
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({ email, password: hashed });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Registration successful', user: { email: user.email } }));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Registration failed' }));
    }
    return;
  }

  // -------------------- LOGIN -------------------- //
  if (pathname === '/login' && method === 'POST') {
    try {
      const { email, password } = await parseJSONBody(req);
      console.log(email,password);
      
      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Email and password are required' }));
        return;
      }

      const user = await User.findOne({ email });
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid email or password' }));
        return;
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid email or password' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Login successful', user: { email: user.email } }));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Login failed' }));
    }
    return;
  }

  // -------------------- OVERRIDE APIs -------------------- //
  if (pathname === '/override') {
    if (method === 'GET') {
      const lat = parsedUrl.searchParams.get('lat');
      const lon = parsedUrl.searchParams.get('lon');
      const date = parsedUrl.searchParams.get('date');
      const email = parsedUrl.searchParams.get('email');
      if (!lat || !lon || !date || !email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing lat, lon, date, or email' }));
        return;
      }
      const override = await getLatestOverride(lat, lon, date, email);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(override || {}));
      return;
    }

    if (method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { lat, lon, date, values, email } = JSON.parse(body);
          if (!lat || !lon || !date || !values || !email) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'lat, lon, date, values, email required' }));
            return;
          }
          const newEntry = await addOverride(lat, lon, date, values, email);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newEntry));
        } catch (err) {
          console.error(err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
      return;
    }

    if (method === 'DELETE') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { lat, lon, date, email } = JSON.parse(body);
          const removed = await removeOverride(lat, lon, date, email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ removed: !!removed }));
        } catch (err) {
          console.error(err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  // -------------------- STATIC FILE HANDLING -------------------- //
  let safePath = pathname.includes('..') ? '/' : pathname;
  let filePath;

  if (safePath === '/') {
    filePath = path.join(__dirname, 'public', 'login.html');
  } else if (safePath === '/register') {
    filePath = path.join(__dirname, 'public', 'register.html');
  } else if (safePath === '/weather') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else {
    filePath = path.join(__dirname, 'public', safePath);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': getMime(filePath) });
    res.end(data);
  });
});

const PORT = 8000
server.listen(PORT, () => console.log(`🌤️ Weather.io running at http://localhost:${PORT}`));