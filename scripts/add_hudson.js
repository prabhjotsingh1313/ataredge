const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'data.db');
const db = new sqlite3.Database(dbPath);

const tutor = {
  name: 'Hudson Rohloff',
  email: 'hudson@ataredgeacademy.com.au',
  is_tutor: 1,
  bio: 'Scholarship recipient and Bachelor of Engineering and Business student with an ATAR of 96.6. Specializing in Specialist Mathematics, Methods, and Chemistry. Available online and in-person near Carindale, Garden City Library, Carindale Library, Mount Gravatt, and nearby suburbs.',
  atar: '96.6',
  degree: 'Bachelor of Engineering and Business',
  experience: null,
  availability: 'In-person near Carindale, Garden City Library, Carindale Library, Mount Gravatt, and nearby suburbs; online',
  price_y9: 45,
  price_y10_12: 55,
  subjects: 'Specialist:87; Methods:91; Chemistry:89',
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
