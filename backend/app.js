const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "music_portfolio_secret";

// Мидлвары
app.use(cors());
app.use(express.json());
app.use(
  fileUpload({
    createParentPath: true,
  })
);

// Папка для загрузок
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Раздаём файлы из папки uploads по пути /uploads/...
app.use("/uploads", express.static(uploadsDir));

/**
 * Мидлварь: проверка токена (авторизация)
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
 * Список треков (теперь включает lyrics)
 */
app.get("/api/tracks", (req, res) => {
  db.all(
    `
    SELECT
      id,
      title,
      filename,
      cover_filename,
      lyrics,
      '/uploads/' || filename AS file_url,
      CASE
        WHEN cover_filename IS NOT NULL THEN '/uploads/' || cover_filename
        ELSE NULL
      END AS cover_url
    FROM tracks
    ORDER BY created_at DESC
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
 * Принимает:
 *  - form-data: file (аудио) – ОБЯЗАТЕЛЬНО
 *  - form-data: cover (картинка) – НЕобязательно
 *  - form-data: title (название) – можно пустым
 *  - form-data: lyrics (текст песни) – можно пустым
 */
app.post("/api/tracks", authMiddleware, adminOnly, (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).send("Не передан файл трека (file)");
  }

  const audioFile = req.files.file;
  const title = req.body.title || audioFile.name;
  const lyricsText = (req.body.lyrics || "").trim();
  const lyrics = lyricsText.length > 0 ? lyricsText : null;

  const audioExt = path.extname(audioFile.name);
  const audioName = `track_${Date.now()}${audioExt}`;
  const audioPath = path.join(uploadsDir, audioName);

  let coverName = null;

  // Функция для записи в БД
  const insertRow = () => {
    db.run(
      `
      INSERT INTO tracks (title, filename, cover_filename, lyrics)
      VALUES (?, ?, ?, ?)
    `,
      [title, audioName, coverName, lyrics],
      function (err) {
        if (err) {
          console.error("Ошибка вставки трека:", err);
          return res.status(500).send("Ошибка сохранения в БД");
        }

        const id = this.lastID;
        res.json({
          id,
          title,
          file_url: `/uploads/${audioName}`,
          cover_url: coverName ? `/uploads/${coverName}` : null,
          lyrics,
        });
      }
    );
  };

  // Сохраняем аудиофайл
  audioFile.mv(audioPath, (errMove) => {
    if (errMove) {
      console.error("Ошибка сохранения трека:", errMove);
      return res.status(500).send("Ошибка загрузки трека");
    }

    // Если есть обложка, сохраняем её
    if (req.files && req.files.cover) {
      const coverFile = req.files.cover;
      const coverExt = path.extname(coverFile.name);
      coverName = `cover_${Date.now()}${coverExt}`;
      const coverPath = path.join(uploadsDir, coverName);

      coverFile.mv(coverPath, (errCover) => {
        if (errCover) {
          console.error("Ошибка сохранения обложки:", errCover);
          return res.status(500).send("Ошибка загрузки обложки");
        }
        insertRow();
      });
    } else {
      // Обложки нет — просто пишем трек в БД
      insertRow();
    }
  });
});

// Простой корневой маршрут для проверки
app.get("/", (req, res) => {
  res.send("Backend работает");
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});