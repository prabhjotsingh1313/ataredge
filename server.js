require('dotenv').config();
console.log("SendGrid enabled:", !!process.env.SENDGRID_API_KEY);
const fs = require('fs');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const sgMail = require('@sendgrid/mail');

const app = express();
// Support configurable data directory (useful for hosts that require mounting a writable volume)
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {
  console.error('Could not create data directory', dataDir, e);
}
const dbPath = path.join(dataDir, 'data.db');
let db;
try {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to open SQLite DB at', dbPath, err);
      console.error('If running on a platform with an ephemeral filesystem, mount a persistent directory and set DATA_DIR to that path.');
      process.exit(1);
    }
  });
} catch (err) {
  console.error('SQLite initialization error', err);
  process.exit(1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));


// Initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    is_tutor INTEGER DEFAULT 0,
    bio TEXT
  )`);
  // Add optional columns for tutor profiles (safe to run even if they already exist)
  db.run("ALTER TABLE users ADD COLUMN atar TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN degree TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN experience TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN availability TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN price_y9 INTEGER", () => {});
  db.run("ALTER TABLE users ADD COLUMN price_y10_12 INTEGER", () => {});
  db.run("ALTER TABLE users ADD COLUMN subjects TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN photo TEXT", () => {});
  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT,
    email TEXT,
    mobile TEXT,
    atar TEXT,
    highSchool TEXT,
    graduationYear TEXT,
    university TEXT,
    degree TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // ensure status exists on older DBs
  db.run("ALTER TABLE contacts ADD COLUMN status TEXT", () => {});
  db.run(`CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER,
    fullName TEXT,
    email TEXT,
    mobile TEXT,
    relation TEXT,
    yearLevel TEXT,
    school TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Ensure status column exists for older DBs
  db.run("ALTER TABLE inquiries ADD COLUMN status TEXT", () => {});
});

// Configure SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || 'prabhjot@ataredgeacademy.com.au';
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('Warning: SENDGRID_API_KEY is not set. Emails will not be sent.');
}

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login');
}

app.get('/', (req, res) => {
  db.all('SELECT id, name, bio, atar, degree, photo FROM users WHERE is_tutor=1', (err, tutors) => {
    if (err) tutors = [];
    res.render('index', { user: req.session.user, tutors });
  });
});

app.get('/signup', (req, res) => res.render('signup'));
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.redirect('/signup');
  const hash = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name, email, hash], function(err) {
    if (err) return res.redirect('/signup');
    req.session.userId = this.lastID;
    req.session.user = { id: this.lastID, name, email };
    res.redirect('/');
  });
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (!user) return res.redirect('/login');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.redirect('/login');
    req.session.userId = user.id;
    req.session.user = { id: user.id, name: user.name, email: user.email, is_tutor: user.is_tutor };
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/tutors/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM users WHERE id = ? AND is_tutor=1', [id], (err, tutor) => {
    if (!tutor) return res.status(404).send('Tutor not found');
    res.render('tutor', { tutor, user: req.session.user, success: false });
  });
});

// Handle contact form submissions for a tutor
app.post('/tutors/:id/contact', (req, res) => {
  const id = req.params.id;
  const { fullName, email, mobile, relation, yearLevel, school, message } = req.body;
  db.run(
    'INSERT INTO inquiries (tutor_id, fullName, email, mobile, relation, yearLevel, school, message, status) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, fullName, email, mobile, relation, yearLevel, school, message, 'new'],
    function(err) {
      if (err) {
        console.error('Inquiry save error', err);
        return res.status(500).send('Could not submit enquiry');
      }
      // After saving, load tutor and send emails (if configured)
      db.get('SELECT * FROM users WHERE id = ? AND is_tutor=1', [id], (err, tutor) => {
        if (!tutor) return res.status(404).send('Tutor not found');

        // Prepare email content
        const subject = `New enquiry for ${tutor.name} — ${fullName}`;
        const textBody = `New enquiry for ${tutor.name}\n\nFrom: ${fullName} (${relation})\nEmail: ${email}\nMobile: ${mobile}\nYear level: ${yearLevel}\nSchool: ${school}\n\nMessage:\n${message}`;
        const htmlBody = `<p>New enquiry for <strong>${tutor.name}</strong></p>
          <p><strong>From:</strong> ${fullName} (${relation})</p>
          <p><strong>Email:</strong> ${email}<br/><strong>Mobile:</strong> ${mobile}</p>
          <p><strong>Year level:</strong> ${yearLevel} &nbsp; <strong>School:</strong> ${school}</p>
          <hr/><p>${message.replace(/\n/g,'<br/>')}</p>`;

        // Internal email to founder, CC tutor if tutor has email
        if (SENDGRID_API_KEY) {
          const internalMsg = {
            to: FOUNDER_EMAIL,
            from: FOUNDER_EMAIL,
            subject,
            text: textBody,
            html: htmlBody,
          };
          if (tutor.email) internalMsg.cc = tutor.email;

          sgMail.send(internalMsg).catch(err => console.error('SendGrid internal send error:', err));

          // Confirmation email to the submitter
          const confirmMsg = {
            to: email,
            from: FOUNDER_EMAIL,
            subject: `We've received your enquiry for ${tutor.name}`,
            text: `Thanks ${fullName},\n\nWe received your message and will connect you with ${tutor.name} soon.\n\n${textBody}`,
            html: `<p>Thanks ${fullName},</p><p>We received your message and will connect you with <strong>${tutor.name}</strong> soon.</p><hr/>${htmlBody}`
          };
          sgMail.send(confirmMsg).catch(err => console.error('SendGrid confirmation send error:', err));
        }

        // Render success page regardless of email outcome
        res.render('tutor', { tutor, user: req.session.user, success: true });
      });
    }
  );
});

// Our Tutors listing page
app.get('/tutors', (req, res) => {
  const subject = req.query.subject;
  let sql = 'SELECT id, name, bio, atar, degree, price_y9, price_y10_12, subjects, photo FROM users WHERE is_tutor=1';
  const params = [];
  if (subject) {
    sql += ' AND subjects LIKE ?';
    params.push('%' + subject + '%');
  }
  db.all(sql, params, (err, tutors) => {
    if (err) tutors = [];
    res.render('tutors', { user: req.session.user, tutors, filter: subject || '' });
  });
});

app.get('/join', requireAuth, (req, res) => res.render('join', { user: req.session.user }));
app.post('/join', requireAuth, (req, res) => {
  const { bio } = req.body;
  db.run('UPDATE users SET is_tutor=1, bio=? WHERE id=?', [bio || '', req.session.userId], function(err) {
    if (err) return res.redirect('/join');
    req.session.user.is_tutor = 1;
    res.redirect('/');
  });
});

app.get('/about', (req, res) => res.render('about', { user: req.session.user }));
app.get('/contact', (req, res) => res.render('contact', { user: req.session.user }));
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  db.run(
    'INSERT INTO contacts (name,email,message,status) VALUES (?,?,?,?)',
    [name, email, message, 'new'],
    function(err) {
      if (err) {
        console.error('Contact save error', err);
        return res.status(500).send('Could not submit message');
      }

      // send emails using SendGrid if configured
      db.get('SELECT ? as dummy', [], (e) => {
        if (typeof sgMail !== 'undefined' && SENDGRID_API_KEY) {
          const subj = `Website contact: ${name}`;
          const text = `From: ${name}\nEmail: ${email}\n\n${message}`;
          const html = `<p><strong>From:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><hr/><p>${message.replace(/\n/g,'<br/>')}</p>`;

          const internal = { to: FOUNDER_EMAIL, from: FOUNDER_EMAIL, subject: subj, text, html };
          sgMail.send(internal).catch(err => console.error('SendGrid contact internal error', err));

          const confirm = { to: email, from: FOUNDER_EMAIL, subject: `We received your message`, text: `Thanks ${name}, we received your message.`, html: `<p>Thanks ${name},</p><p>We received your message and will be in touch.</p>` };
          sgMail.send(confirm).catch(err => console.error('SendGrid contact confirm error', err));
        }
        res.render('contact', { user: req.session.user, success: true });
      });
    }
  );
});

// Services page
app.get('/services', (req, res) => res.render('services', { user: req.session.user }));

// Privacy & Terms pages
app.get('/privacy', (req, res) => res.render('privacy', { user: req.session.user }));
app.get('/terms', (req, res) => res.render('terms', { user: req.session.user }));

// Public Join Our Team application (stores in applications table)
app.get('/join-team', (req, res) => {
  res.render('join-team', { user: req.session.user, success: false });
});

app.post('/join-team', (req, res) => {
  const { fullName, email, mobile, atar, highSchool, graduationYear, university, degree, message } = req.body;
  db.run(
    'INSERT INTO applications (fullName,email,mobile,atar,highSchool,graduationYear,university,degree,message) VALUES (?,?,?,?,?,?,?,?,?)',
    [fullName, email, mobile, atar, highSchool, graduationYear, university, degree, message],
    function(err) {
      if (err) {
        console.error('Application save error', err);
        return res.render('join-team', { user: req.session.user, success: false });
      }
      res.render('join-team', { user: req.session.user, success: true });
    }
  );
});

// --- Admin area ---
function requireFounder(req, res, next) {
  const founder = process.env.FOUNDER_EMAIL || 'prabhjot@ataredgeacademy.com.au';
  if (req.session && req.session.user && req.session.user.email === founder) return next();
  return res.status(403).send('Forbidden');
}

app.get('/admin', requireFounder, (req, res) => {
  db.get('SELECT COUNT(*) AS c FROM inquiries', (err, iq) => {
    db.get('SELECT COUNT(*) AS c FROM applications', (err2, appc) => {
      db.get('SELECT COUNT(*) AS c FROM contacts', (err3, cc) => {
        res.render('admin', { user: req.session.user, counts: { inquiries: iq.c||0, applications: appc.c||0, contacts: cc.c||0 } });
      });
    });
  });
});

app.get('/admin/inquiries', requireFounder, (req, res) => {
  db.all('SELECT i.*, u.name AS tutor_name FROM inquiries i LEFT JOIN users u ON i.tutor_id=u.id ORDER BY i.created_at DESC', (err, rows) => {
    res.render('admin_inquiries', { user: req.session.user, inquiries: rows || [] });
  });
});

app.post('/admin/inquiries/:id/status', requireFounder, (req, res) => {
  const id = req.params.id; const { status } = req.body;
  db.run('UPDATE inquiries SET status = ? WHERE id = ?', [status || 'read', id], function() {
    res.redirect('/admin/inquiries');
  });
});

app.get('/admin/applications', requireFounder, (req, res) => {
  db.all('SELECT * FROM applications ORDER BY created_at DESC', (err, rows) => {
    res.render('admin_applications', { user: req.session.user, applications: rows || [] });
  });
});

app.post('/admin/applications/:id/delete', requireFounder, (req, res) => {
  const id = req.params.id; db.run('DELETE FROM applications WHERE id = ?', [id], () => res.redirect('/admin/applications'));
});

app.get('/admin/contacts', requireFounder, (req, res) => {
  db.all('SELECT * FROM contacts ORDER BY created_at DESC', (err, rows) => {
    res.render('admin_contacts', { user: req.session.user, contacts: rows || [] });
  });
});

app.post('/admin/contacts/:id/status', requireFounder, (req, res) => {
  const id = req.params.id; const { status } = req.body;
  db.run('UPDATE contacts SET status = ? WHERE id = ?', [status || 'read', id], function() {
    res.redirect('/admin/contacts');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
