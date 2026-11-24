'use strict';
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
const location=process.env.DB_PATH||path.join(__dirname,'data','sena.sqlite');
fs.mkdirSync(path.dirname(location),{recursive:true});
const db=new DatabaseSync(location);
const ensureColumn = (table, column, definition) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (error) {
    const msg = String(error?.message || '');
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) throw error;
  }
};

db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','editor')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Gestão', body_json TEXT NOT NULL DEFAULT '[]', art TEXT NOT NULL DEFAULT 'xadrez', read_minutes INTEGER NOT NULL DEFAULT 4, featured INTEGER NOT NULL DEFAULT 0, trending INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_articles_public ON articles(status,published_at DESC);
CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'active');
CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS password_reset_tokens (id INTEGER PRIMARY KEY, email TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS revoked_tokens (id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
db.exec("CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slot TEXT NOT NULL, image_url TEXT, image_mobile_url TEXT, href TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS idx_ads_slot ON ads(slot,active);");
db.exec("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, color TEXT NOT NULL DEFAULT '#1B2F6E', is_top INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 100);");
{
  const seedCat = db.prepare('INSERT OR IGNORE INTO categories(name,color,is_top,position) VALUES(?,?,1,?)');
  [['Estratégia', '#3E8F8C'], ['Sena Decisor', '#1B2F6E'], ['Sena Ascensão', '#F5C24B'], ['Entrevistas', '#C0682F'], ['Opinião', '#8B5CF6']].forEach(([n, c], i) => seedCat.run(n, c, i));
}
db.exec("CREATE TABLE IF NOT EXISTS slides (id INTEGER PRIMARY KEY, image_url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '', href TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);");
db.exec("CREATE TABLE IF NOT EXISTS sponsored (id INTEGER PRIMARY KEY, brand TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', cta TEXT NOT NULL DEFAULT 'Saber mais', href TEXT NOT NULL DEFAULT '', image_url TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);");
db.exec("CREATE TABLE IF NOT EXISTS partners (id INTEGER PRIMARY KEY, name TEXT NOT NULL, image_url TEXT NOT NULL, href TEXT NOT NULL DEFAULT '', position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);");
ensureColumn('articles', 'image_url', 'TEXT DEFAULT NULL');
const setting=db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
for(const [k,v] of Object.entries({company:'SENA EXECUTIVA',email:'geral@senaexecutiva.ao',phone:'+244 942 620 546',location:'Luanda, Angola',about:'Uma revista executiva dedicada às pessoas, empresas e decisões que movem Angola.'}))setting.run(k,v);
if(db.prepare('SELECT COUNT(*) n FROM articles').get().n===0 && process.env.SEED_DEMO!=='0') {
 const seed=require('./data/seed-articles.json');
 const add=db.prepare('INSERT INTO articles(slug,title,excerpt,category,body_json,art,image_url,read_minutes,featured,trending,status,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const a of seed)add.run(a.id,a.title,a.excerpt,a.cat,JSON.stringify(a.body),a.art,null,a.read,a.featured?1:0,a.trend?1:0,'published',a.date);
}
module.exports=db;
