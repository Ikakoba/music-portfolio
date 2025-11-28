const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "music_portfolio_secret";

// Мидлвары
app.use(cors());
app.use(express.json());

/**
 * Мидлваль: проверка токена (авторизация)
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).send("Требуется авторизация");
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).send("Неверный токен");
    }
    req.user = payload; // { id, login, role }
    next();
  });
}

/**
 * Мидлварь: только админ
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send("Доступ только для администратора");
  }
  next();
}

/**
 * POST /api/login
 * Вход пользователя (для нас важен админ)
 */
app.post("/api/login", (req, res) => {
  const { login, username, password } = req.body;
  const userLogin = login || username;

  if (!userLogin || !password) {
    return res.status(400).send("Нужны логин и пароль");
  }

  db.get(
    `SELECT * FROM users WHERE login = ?`,
    [userLogin],
    (err, user) => {
      if (err) {
        console.error("Ошибка БД при логине:", err);
        return res.status(500).send("Ошибка сервера");
      }
      if (!user) {
        return res.status(401).send("Неверный логин или пароль");
      }

      bcrypt.compare(password, user.password_hash, (errCmp, same) => {
        if (errCmp) {
          console.error("Ошибка сравнения пароля:", errCmp);
          return res.status(500).send("Ошибка сервера");
        }
        if (!same) {
          return res.status(401).send("Неверный логин или пароль");
        }

        const token = jwt.sign(
          {
            id: user.id,
            login: user.login,
            role: user.role,
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.json({ token });
      });
    }
  );
});

/**
 * GET /api/tracks
 * Список треков (включая lyrics)
 */
app.get("/api/tracks", (req, res) => {
  db.all(
    `
    SELECT
      id,
      title,
      google_drive_audio_id,
      google_drive_cover_id,
      lyrics,
      CASE
        WHEN google_drive_audio_id IS NOT NULL 
        THEN 'https://drive.google.com/uc?export=download&id=' || google_drive_audio_id
        ELSE NULL
      END AS file_url,
      CASE
        WHEN google_drive_cover_id IS NOT NULL 
        THEN 'https://drive.google.com/uc?export=view&id=' || google_drive_cover_id
        ELSE NULL
      END AS cover_url
    FROM tracks
    ORDER BY created_at DESC, id DESC
  `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Ошибка получения треков:", err);
        return res.status(500).send("Ошибка сервера");
      }
      res.json(rows);
    }
  );
});

/**
 * POST /api/tracks
 * Загрузка нового трека (только админ)
 * Принимает JSON:
 *  - title (название) - можно пустым
 *  - google_drive_audio_id (ID аудио файла) - ОБЯЗАТЕЛЬНО
 *  - google_drive_cover_id (ID обложки) - НЕобязательно
 *  - lyrics (текст песни) - можно пустым
 */
app.post("/api/tracks", authMiddleware, adminOnly, (req, res) => {
  const { title, google_drive_audio_id, google_drive_cover_id, lyrics } = req.body;

  if (!google_drive_audio_id) {
    return res.status(400).send("Не передан google_drive_audio_id");
  }

  const trackTitle = title || "Без названия";
  const lyricsText = (lyrics || "").trim();
  const finalLyrics = lyricsText.length > 0 ? lyricsText : null;

  // Создаем ссылки на Google Drive
  const file_url = `https://drive.google.com/uc?export=download&id=${google_drive_audio_id}`;
  const cover_url = google_drive_cover_id 
    ? `https://drive.google.com/uc?export=view&id=${google_drive_cover_id}`
    : null;

  db.run(
    `
    INSERT INTO tracks (title, google_drive_audio_id, google_drive_cover_id, lyrics, file_url, cover_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [trackTitle, google_drive_audio_id, google_drive_cover_id, finalLyrics, file_url, cover_url],
    function (err) {
      if (err) {
        console.error("Ошибка вставки трека:", err);
        return res.status(500).send("Ошибка сохранения в БД");
      }

      const id = this.lastID;
      res.json({
        id,
        title: trackTitle,
        file_url,
        cover_url,
        lyrics: finalLyrics,
        google_drive_audio_id,
        google_drive_cover_id
      });
    }
  );
});

/**
 * DELETE /api/tracks/:id
 * Удаление трека (только админ) - только из базы данных
 */
app.delete("/api/tracks/:id", authMiddleware, adminOnly, (req, res) => {
  const trackId = req.params.id;

  db.run(
    `DELETE FROM tracks WHERE id = ?`,
    [trackId],
    function (err) {
      if (err) {
        console.error("Ошибка удаления трека из БД:", err);
        return res.status(500).send("Ошибка сервера");
      }
      if (this.changes === 0) {
        return res.status(404).send("Трек не найден");
      }
      res.json({ success: true });
    }
  );
});

// Простой корневой маршрут для проверки
app.get("/", (req, res) => {
  res.send("Backend работает с Google Drive");
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});