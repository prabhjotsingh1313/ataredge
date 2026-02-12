const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(dbPath);

const tutor = {
  name: 'Hariharan Manikandan',
  email: 'hariharan@ataredgeacademy.com.au',
  is_tutor: 1,
  bio: 'First year Medicine student at Monash University with 2 years tutoring experience. Available online only.',
  atar: '99.45',
  degree: 'Bachelor of Medical Science / Doctor of Medicine (Monash University)',
  experience: '2 years',
  availability: 'Online only',
  price_y9: 40,
  price_y10_12: 50,
  subjects: 'Biology:100/100; Physics:99/100; Chemistry:98/100; Methods:96/100',
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
