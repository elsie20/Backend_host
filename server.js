const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const server = express();
const PORT = 5000;


server.use(cors());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));


const FRONTEND_DIR = path.join(__dirname, '..', 'Frontend');
server.use(express.static(FRONTEND_DIR));

server.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});


server.post('/api/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name,email,phone,password_hash,role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,name,email,phone,role`,
      [name, email, phone, password_hash, role || 'user']
    );

    res.status(201).json({ message: 'Registration successful', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});


server.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    delete user.password_hash;
    res.json({ message: 'Login successful', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});


server.put('/api/profile', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    let query, values;

    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      query = `UPDATE users SET name=$1, password_hash=$2 WHERE email=$3 RETURNING id,name,email,phone,role`;
      values = [name, password_hash, email];
    } else {
      query = `UPDATE users SET name=$1 WHERE email=$2 RETURNING id,name,email,phone,role`;
      values = [name, email];
    }

    const result = await pool.query(query, values);
    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Profile update failed' });
  }
});


server.delete('/api/profile', async (req, res) => {
  try {
    const { email } = req.body;
    await pool.query('DELETE FROM users WHERE email=$1', [email]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});


server.get('/api/books', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM books WHERE available = TRUE ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch books' });
  }
});


server.post('/api/borrow', async (req, res) => {
  try {
    const { book_id, user_email } = req.body;

    
    const bookCheck = await pool.query('SELECT * FROM books WHERE id=$1 AND available=TRUE', [book_id]);
    if (bookCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Book not available' });
    }

    
    await pool.query('INSERT INTO borrowed_books (book_id,user_email) VALUES ($1,$2)', [book_id, user_email]);

    
    await pool.query('UPDATE books SET available=FALSE WHERE id=$1', [book_id]);

    res.json({ message: 'Book borrowed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Borrow failed' });
  }
});


server.post('/api/return', async (req, res) => {
  try {
    const { book_id, user_email } = req.body;

    
    await pool.query('UPDATE borrowed_books SET returned=TRUE WHERE book_id=$1 AND user_email=$2 AND returned=FALSE', [book_id, user_email]);

    
    await pool.query('UPDATE books SET available=TRUE WHERE id=$1', [book_id]);

    res.json({ message: 'Book returned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Return failed' });
  }
});


server.get('/api/borrowed/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      `SELECT b.id, b.title, b.author, b.price, bb.borrowed_at, bb.returned
       FROM borrowed_books bb
       JOIN books b ON bb.book_id = b.id
       WHERE bb.user_email=$1`,
      [email]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch borrowed books' });
  }
});

server.listen(PORT, () => console.log(` Server running at http://localhost:${PORT}`));
