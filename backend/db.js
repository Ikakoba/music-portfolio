const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

// Путь к файлу базы данных (лежит рядом с db.js)
const dbFile = path.join(__dirname, "database.sqlite");

// Подключаемся к SQLite
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

  // Таблица треков
  db.run(
    `
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      filename TEXT NOT NULL,
      cover_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  );

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
            console.error("Ошибка хеширования пароля администратора:", errHash);
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

// Экспортируем ИМЕННО сам объект db, у которого есть методы get, all, run
module.exports = db;