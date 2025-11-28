const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

const dbFile = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbFile);

// Инициализация таблиц и создание админа
db.serialize(() => {
  // Таблица пользователей
  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `
  );

  // Таблица треков (если создаётся с нуля — сразу с колонкой lyrics)
  db.run(
    `
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      filename TEXT NOT NULL,
      cover_filename TEXT,
      lyrics TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  );

  // Если таблица уже существовала без lyrics — попробуем добавить колонку
  db.run(`ALTER TABLE tracks ADD COLUMN lyrics TEXT`, (err) => {
    if (err) {
      // Если ошибка "duplicate column name" — значит колонка уже есть, это нормально
      if (!String(err.message).includes("duplicate column name")) {
        console.error("Ошибка добавления колонки lyrics:", err);
      }
    }
  });

  // Проверяем, есть ли админ
  const adminLogin = "admin";
  const adminPass = "adminpass";
  const saltRounds = 10;

  db.get(
    `SELECT id FROM users WHERE login = ?`,
    [adminLogin],
    (err, row) => {
      if (err) {
        console.error("Ошибка проверки администратора:", err);
        return;
      }
      if (!row) {
        // Админа нет — создаём
        bcrypt.hash(adminPass, saltRounds, (errHash, hash) => {
          if (errHash) {
            console.error(
              "Ошибка хеширования пароля администратора:",
              errHash
            );
            return;
          }
          db.run(
            `INSERT INTO users (login, password_hash, role)
             VALUES (?, ?, 'admin')`,
            [adminLogin, hash],
            (errInsert) => {
              if (errInsert) {
                console.error("Ошибка создания администратора:", errInsert);
              } else {
                console.log("Администратор создан!");
                console.log("  Логин: admin");
                console.log("  Пароль: adminpass");
              }
            }
          );
        });
      }
    }
  );
});

module.exports = db;