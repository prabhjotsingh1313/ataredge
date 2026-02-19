const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(dbPath);

const tutor = {
  name: 'Luqmaan Seedat',
  email: 'luqmaan@ataredgeacademy.com.au',
  is_tutor: 1,
  bio: 'IB tutor with an IB score of 41.75 and ATAR equivalent of 98.00, specializing in Chemistry and Mathematics. Also offering UCAT preparation with a score of 3140. Available for online tutoring.',
  atar: '98.00',
  degree: null,
  experience: null,
  availability: 'Online only',
  price_y9: 45,
  price_y10_12: 50,
  subjects: 'Chemistry SL/HL; Mathematics AI SL/HL; UCAT Preparation',
  photo: null,
  ucat_score: 3140
};

const sql = `
INSERT INTO users (name,email,is_tutor,bio,atar,degree,experience,availability,price_y9,price_y10_12,subjects,photo,ucat_score)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(email) DO UPDATE SET
  name = excluded.name,
  is_tutor = excluded.is_tutor,
  bio = excluded.bio,
  atar = excluded.atar,
  degree = excluded.degree,
  experience = excluded.experience,
  availability = excluded.availability,
  price_y9 = excluded.price_y9,
  price_y10_12 = excluded.price_y10_12,
  subjects = excluded.subjects,
  photo = excluded.photo,
  ucat_score = excluded.ucat_score
`;

db.run(sql, [tutor.name,tutor.email,tutor.is_tutor,tutor.bio,tutor.atar,tutor.degree,tutor.experience,tutor.availability,tutor.price_y9,tutor.price_y10_12,tutor.subjects,tutor.photo,tutor.ucat_score], function(err){
  if(err) return console.error('Insert error', err);
  if(this.changes === 0) {
    console.log('Tutor already exists (skipped).');
  } else {
    console.log('Inserted tutor with id', this.lastID);
  }
  db.close();
});
