const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(dbPath);

const tutor = {
  name: 'Armin',
  email: 'armin@ataredgeacademy.com.au',
  is_tutor: 1,
  bio: 'IB graduate with 41.75 and ATAR equivalent of 98. Available for online and in-person tutoring on West side of Brisbane, Toowong, and CBD.',
  atar: '98',
  degree: 'Bachelor of Arts, Fine Economy (University of Queensland)',
  experience: '2 years',
  availability: 'West side of Brisbane, Toowong, and CBD and online',
  price_y9: 45,
  price_y10_12: 60,
  subjects: 'Maths AA HL/Maths Methods + Specialist:93; Chemistry HL/Chemistry:86; Physics SL/Physics:84; Business HL:86',
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
