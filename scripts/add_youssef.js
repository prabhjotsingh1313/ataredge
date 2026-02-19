const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(dbPath);

const tutor = {
  name: 'Youssef Hussein',
  email: 'youssef@ataredgeacademy.com.au',
  is_tutor: 1,
  bio: '2nd year Electrical Engineering student at QUT with an ATAR of 94. Specializing in Maths Methods, Physics, and Engineering for Years 10-12. Available online via Google Meet.',
  atar: '94.00',
  degree: 'Bachelor of Engineering (Honours) – Electrical (Queensland University of Technology)',
  experience: '3 years (peer tutoring and exam preparation)',
  availability: 'Online only',
  price_y9: 40,
  price_y10_12: null,
  subjects: 'Maths Methods:76; Physics:84; Engineering:80',
  photo: null
};

const sql = `INSERT OR IGNORE INTO users (name,email,is_tutor,bio,atar,degree,experience,availability,price_y9,price_y10_12,subjects,photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

db.run(sql, [tutor.name,tutor.email,tutor.is_tutor,tutor.bio,tutor.atar,tutor.degree,tutor.experience,tutor.availability,tutor.price_y9,tutor.price_y10_12,tutor.subjects,tutor.photo], function(err){
  if(err) return console.error('Insert error', err);
  if(this.changes === 0) {
    console.log('Tutor already exists (skipped).');
  } else {
    console.log('Inserted tutor with id', this.lastID);
  }
  db.close();
});
