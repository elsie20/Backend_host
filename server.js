require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

const server = express();
const PORT = process.env.PORT || 5000;


server.use(cors({
  origin: [
    'https://elsie20.github.io',
    'http://localhost:5000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

server.use(express.json());
server.use(express.urlencoded({ extended: true }));


server.get('/', (req, res) => {
  res.json({ message: 'Backend isrunning ' });
});



function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}



server.post('/api/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, name, email, phone, role`,
      [name, email, phone, password_hash]
    );

    res.status(201).json({
      message: 'Registration successful',
      user: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

server.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email=$1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    delete user.password_hash;

    res.json({
      message: 'Login successful',
      token,
      user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});



server.get('/api/books', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM books WHERE available = TRUE ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch books' });
  }
});

server.post('/api/borrow', authenticateToken, async (req, res) => {
  try {
    const { book_id } = req.body;
    const user_email = req.user.email;

    const bookCheck = await pool.query(
      'SELECT * FROM books WHERE id=$1 AND available=TRUE',
      [book_id]
    );

    if (bookCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Book not available' });
    }

    await pool.query(
      'INSERT INTO borrowed_books (book_id, user_email) VALUES ($1, $2)',
      [book_id, user_email]
    );

    await pool.query(
      'UPDATE books SET available=FALSE WHERE id=$1',
      [book_id]
    );

    res.json({ message: 'Book borrowed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Borrow failed' });
  }
});



server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
