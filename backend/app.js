const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { createToken, requireAuth, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Мидлвары
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- АУТЕНТИФИКАЦИЯ: регистрация/логин ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!password || !username) return res.status(400).json({ message: "Нет логина/пароля" });
  db.get("SELECT * FROM users WHERE username=?", [username], (err, user) => {
    if (user) return res.status(400).json({ message: "Пользователь существует" });
    bcrypt.hash(password, 10, (err, hash) => {
      db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], function (err) {
        if (err) return res.status(500).json({ message: "Ошибка базы" });
        db.get("SELECT * FROM users WHERE id=?", [this.lastID], (err, user) => {
          const token = createToken(user);
          res.json({ token, user: { id: user.id, username: user.username, is_admin: !!user.is_admin } });
        });
      });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username=?", [username], (err, user) => {
    if (!user) return res.status(400).json({ message: "Нет такого пользователя" });
    bcrypt.compare(password, user.password, (err, same) => {
      if (!same) return res.status(400).json({ message: "Неверный пароль" });
      const token = createToken(user);
      res.json({ token, user: { id: user.id, username: user.username, is_admin: !!user.is_admin } });
    });
  });
});

// --- АЛЬБОМЫ ---
app.get('/api/albums', (req, res) => {
  db.all("SELECT * FROM albums", (err, rows) => res.json(rows));
});

app.post('/api/albums', requireAuth, requireAdmin, (req, res) => {
  const { title } = req.body;
  db.run("INSERT INTO albums (title) VALUES (?)", [title], function (err) {
    if (err) return res.status(500).send();
    res.json({ id: this.lastID, title });
  });
});

// --- ТРЕКИ ---
app.get('/api/tracks', (req, res) => {
  db.all(`SELECT t.*, a.title as album_title 
           FROM tracks t LEFT JOIN albums a ON t.album_id=a.id
           ORDER BY t.created_at DESC`, (err, rows) => res.json(rows));
});

// Загрузка трека (только админ)
app.post('/api/tracks', requireAuth, requireAdmin, (req, res) => {
  if (!req.files || !req.files.file) return res.status(400).send('Нет файла');
  const track = req.files.file;
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/flac'];
  if (!allowed.includes(track.mimetype)) return res.status(400).send('Недопустимый тип файла');

  const audioName = Date.now() + '_' + track.name.replace(/\s/g, '_');
  const audioPath = path.join(__dirname, 'uploads', audioName);

  track.mv(audioPath, (err) => {
    if (err) return res.status(500).send('Ошибка загрузки');
    db.run(
      "INSERT INTO tracks (title, filename, uploaded_by, album_id) VALUES (?, ?, ?, ?)",
      [req.body.title || track.name, audioName, req.user.id, req.body.album_id || null],
      function (err) {
        if (err) return res.status(500).send('Ошибка базы');
        res.json({ id: this.lastID, filename: audioName });
      }
    );
  });
});

// --- Загрузка обложки для трека (админ) ---
app.post('/api/tracks/:id/cover', requireAuth, requireAdmin, (req, res) => {
  if (!req.files || !req.files.cover) return res.status(400).send('Нет файла');
  const cover = req.files.cover;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(cover.mimetype)) return res.status(400).send('Только jpg/png/webp');

  const coverName = Date.now() + '_' + cover.name.replace(/\s/g, '_');
  const coverPath = path.join(__dirname, 'uploads', coverName);

  cover.mv(coverPath, (err) => {
    if (err) return res.status(500).send('Ошибка загрузки');
    db.run("UPDATE tracks SET cover=? WHERE id=?", [coverName, req.params.id], function (err) {
      if (err) return res.status(500).send('Ошибка базы');
      res.json({ cover: coverName });
    });
  });
});

// --- Скачать трек ---
app.get('/api/tracks/:id/download', (req, res) => {
  db.get("SELECT filename FROM tracks WHERE id=?", [req.params.id], (err, row) => {
    if (!row) return res.status(404).send('Трек не найден');
    const filePath = path.join(__dirname, 'uploads', row.filename);
    res.download(filePath);
  });
});

// --- ПЛЕЙЛИСТЫ (user playlists) ---
app.get('/api/playlists', requireAuth, (req, res) => {
  db.all("SELECT * FROM playlists WHERE user_id=?", [req.user.id], (err, rows) => res.json(rows));
});

app.post('/api/playlists', requireAuth, (req, res) => {
  db.run(
    "INSERT INTO playlists (user_id, title) VALUES (?, ?)",
    [req.user.id, req.body.title],
    function (err) {
      if (err) return res.status(500).json({ message: "Ошибка базы" });
      res.json({ id: this.lastID, title: req.body.title });
    }
  );
});

app.post('/api/playlists/:id/tracks', requireAuth, (req, res) => {
  db.run(
    "INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)",
    [req.params.id, req.body.track_id],
    function (err) {
      if (err) return res.status(500).json({ message: "Ошибка базы" });
      res.json({ success: true });
    }
  );
});

app.get('/api/playlists/:id', requireAuth, (req, res) => {
  db.all(
    `SELECT t.* FROM tracks t
     JOIN playlist_tracks pt ON pt.track_id = t.id
     WHERE pt.playlist_id=?`,
    [req.params.id],
    (err, tracks) => res.json(tracks)
  );
});

// --- КОММЕНТАРИИ и ЛАЙКИ ---
app.get('/api/tracks/:id/comments', (req, res) => {
  db.all(
    `SELECT c.*, u.username
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.track_id=?
     ORDER BY c.posted_at DESC`,
    [req.params.id],
    (err, rows) => res.json(rows)
  );
});

app.post('/api/tracks/:id/comments', requireAuth, (req, res) => {
  db.run(
    `INSERT INTO comments (user_id, track_id, text) VALUES (?, ?, ?)`,
    [req.user.id, req.params.id, req.body.text],
    function (err) {
      if (err) return res.status(500).send('Ошибка');
      res.json({ id: this.lastID, text: req.body.text });
    });
});

app.post('/api/tracks/:id/like', requireAuth, (req, res) => {
  db.run(
    `INSERT OR IGNORE INTO likes (user_id, track_id) VALUES (?, ?)`,
    [req.user.id, req.params.id],
    function (err) {
      if (err) return res.status(500).send('Ошибка базы');
      res.json({ liked: true });
    });
});

app.delete('/api/tracks/:id/like', requireAuth, (req, res) => {
  db.run(
    `DELETE FROM likes WHERE user_id=? AND track_id=?`,
    [req.user.id, req.params.id],
    function (err) {
      if (err) return res.status(500).send('Ошибка базы');
      res.json({ liked: false });
    });
});

// Количество лайков по треку:
app.get('/api/tracks/:id/likes', (req, res) => {
  db.get(`SELECT COUNT(*) as cnt FROM likes WHERE track_id=?`, [req.params.id], (err, row) => {
    res.json({ likes: row.cnt });
  });
});

app.listen(PORT, () => {
  if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});