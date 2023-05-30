import sqlite3 from 'sqlite3';

export class DataBase {

    db: sqlite3.Database;

    constructor() {
        this.db = new sqlite3.Database('database.db');
        this.setupDatabase();
    }

    private setupDatabase() {
        this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT,
          accessToken TEXT
        )
      `);
    }

    create(userId: string, accessToken: string) {
        this.db.run('INSERT INTO users (id, accessToken) VALUES (?, ?)', [userId, accessToken], (err) => {
            if (err) {
              console.error(err);
            }
          });
    }

    get(userId: string | null, callback: (accessToken: string | null) => void) {
        this.db.get('SELECT accessToken FROM users WHERE id = ?', [userId], (err, row: {accessToken: string}) => {
            if (err) {
              console.error(err);
              callback(null);
              
            }
            const accessToken = row?.accessToken;
            callback(accessToken);
          });
    }

    
}


