const cors = require('cors');
server.use(cors());

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const server = express();
const PORT = 5000;


server.use(express.json());
server.use(express.urlencoded({ extended: true }));


const FRONTEND_DIR = path.join(__dirname, '..', 'Examination draft');


server.use(express.static(FRONTEND_DIR));


server.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});


server.post('/api/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

   
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone',
      [name, email, phone, password_hash]
    );

    const user = result.rows[0];
    res.status(201).json({
      message: 'Registration successful',
      user,
    });
  } catch (err) {
    console.error('Error in /api/register:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});


server.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter email and password' });
    }

    const result = await pool.query(
      'SELECT id, name, email, phone, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    
    delete user.password_hash;

    res.json({
      message: 'Login successful',
      user,
    });
  } catch (err) {
    console.error('Error in /api/login:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});


server.put('/api/profile', async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name) {
      return res.status(400).json({ message: 'Email and name are required' });
    }

    let result;

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      result = await pool.query(
        'UPDATE users SET name = $1, password_hash = $2 WHERE email = $3 RETURNING id, name, email, phone',
        [name, password_hash, email]
      );
    } else {
      result = await pool.query(
        'UPDATE users SET name = $1 WHERE email = $2 RETURNING id, name, email, phone',
        [name, email]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('Error in /api/profile PUT:', err);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

server.delete('/api/profile', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const result = await pool.query('DELETE FROM users WHERE email = $1 RETURNING id', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile deleted successfully' });
  } catch (err) {
    console.error('Error in /api/profile DELETE:', err);
    res.status(500).json({ message: 'Server error while deleting profile' });
  }
});


server.post('/api/borrow', async (req, res) => {
  try {
    const { title, author, isbn, price } = req.body;

    if (!title || !author || !isbn || !price) {
      return res.status(400).json({ message: 'title, author, isbn and price are required' });
    }

    const result = await pool.query(
      'INSERT INTO books (title, author, isbn, price) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, author, isbn, price]
    );

    res.status(201).json({
      message: 'Book saved to database',
      book: result.rows[0],
    });
  } catch (err) {
    console.error('Error in /api/borrow:', err);
    res.status(500).json({ message: 'Server error while saving borrowed book' });
  }
});


server.get('/api/books', (req, res) => {
  res.json([
    { title: 'The Silent Patient', author: 'Alex Michaelides', isbn: '1234', price: 250 },
    { title: 'Year of the Water Horse', author: 'Jane Doe', isbn: '5678', price: 210 },
    { title: 'The Fault in Our Stars', author: 'John Green', isbn: '91011', price: 100 },
  ]);
});


server.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
});


