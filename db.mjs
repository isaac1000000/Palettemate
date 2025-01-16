import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
import { randomBytes, createHash } from 'crypto';
import * as paintscraper from './scraping/paint.mjs';
import { mkdirSync } from 'fs';

const REFRESH = false;

const pool = new Pool({
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
})

async function createUserTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id        SERIAL PRIMARY KEY,
      username  VARCHAR(30) NOT NULL UNIQUE,
      email     TEXT NOT NULL UNIQUE,
      password  BYTEA NOT NULL,
      salt      BYTEA NOT NULL
    )
  `);
}

// TODO: Verify emails
export async function register(username, email, password) {
  const salt = randomBytes(8);
  const res = await pool.query(`
    INSERT INTO users ("username", "email", "password", "salt") VALUES
    ($1, $2, $3, $4)
    RETURNING *
  `, [username, email, createHash('sha256').update(Buffer.concat([Buffer.from(password), salt])).digest('hex'), salt])
    .catch(e => {
      if (e.code === '23505') {
        throw({ message: `Duplicate Entry For ${e.constraint}` });
      } else if (e.code === '22001') {
        throw({ message: 'Username Too Long: <40 Characters Please'});
      } else {
        console.log(e)
        throw({ message: 'An Unexpected Error Occured'});
      }
    })
  return res.rows[0]
}

// Can log in with username or password
export async function login(identifier, password) {
  const userSearch = await pool.query(`
    SELECT * FROM users
    WHERE username = $1 OR email = $1
    LIMIT 1
  `, [identifier])
  .then(res => res.rows[0]);
  if (!userSearch) {
    throw ({ message: 'User Not Found' })
  } else if (createHash('sha256').update(Buffer.concat([Buffer.from(password), userSearch.salt])).digest('hex') != userSearch.password) {
    throw ({ message: 'Password Incorrect' })
  }
  return userSearch
}

// PAINT SUPPLIERS
const PAINT_SRCS = [
  {
    url: 'https://www.dickblick.com/products/gamblin-artists-oil-colors/',
    brand: 'Gamblin',
    quality: 'Professional',
    line: 'artists',
    type: 'oil'
  },
  {
    url: 'https://www.dickblick.com/products/gamblin-1980-oil-colors/',
    brand: 'Gamblin',
    quality: 'Student',
    line: '1980',
    type: 'oil'
  },
  {
    url: 'https://www.dickblick.com/products/utrecht-artists-oil-colors/',
    brand: 'Utrecht',
    quality: 'Professional',
    line: 'artists',
    type: 'oil'
  }
]

export async function createPaintTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS paints (
      id                SERIAL PRIMARY KEY,
      color             TEXT NOT NULL,
      brand             TEXT,
      srcurl            TEXT,
      sku               VARCHAR(25),
      sysid             TEXT,
      imgurl            TEXT,
      price             DECIMAL(5, 2),
      quality           TEXT,
      line              TEXT,
      type              TEXT,
      size              TEXT,
      pigments          TEXT,
      cei               TEXT,
      lightfastness     TEXT,
      colorfamily       TEXT
    )`
  );
}

const imgs={}
export async function updatePaintTable() {
  let paints = [];
  // Make parallel after troubleshooting
  for (const src of PAINT_SRCS) {
    let curr = await paintscraper.getPaintsFromPage(src.url);
    const srcImgDir = `/img/${src.brand}/${src.line.replaceAll(' ', '-')}-${src.type}/`
    mkdirSync('./public/'+srcImgDir, { recursive: true })
    curr = await Promise.all(curr.map(async ele => {
      ele.description=ele.description.trim()
      ele.brand=src.brand;
      ele.quality=src.quality;
      ele.line=src.line;
      ele.type=src.type;
      ele.imgurl=`${srcImgDir}${ele.description.replaceAll(' ', '-')}.jpg`
      if (imgs[ele.imgurl] === undefined) {
        imgs[ele.imgurl] = ele.imgsrc
        try {
          await paintscraper.downloadImage(ele.imgsrc, './public/'+ele.imgurl);
        } catch (error) {'error fetching image', console.log(error)}
      }
      return ele;
    }));
    paints = paints.concat(curr)
  }
  await Promise.all(paints.map(async paint => {
    addPaint(paint)
  }));
  console.log('Done updating paint table')
}

export async function addPaint(paint) {
  return await pool.query(`
    INSERT INTO paints ("color", "brand", "srcurl", "sku", "sysid", "imgurl", "price", "quality", "line", "type", "size", "pigments", "cei", "lightfastness", "colorfamily") VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `, [paint.description, paint.brand, 'https://www.dickblick.com' + paint.url, paint.sku, paint.sysid, paint.imgurl, paint.price, paint.quality, paint.line, paint.type, paint.size, paint.pigments, paint.cei, paint.lightfastness, paint.colorfamily]);
}


export async function createPaletteTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS palettes (
      id                SERIAL PRIMARY KEY,
      name              TEXT NOT NULL,
      owner             INT REFERENCES users,
      createdat         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

export async function createPalette(palette) {
  const res = await pool.query(`
    INSERT INTO palettes ("name", "owner") VALUES
    ($1, $2)
    RETURNING *
  `, [palette.name, palette.userId])
  res.rows[0].paints = []
  return res.rows[0]
}

export async function createPaletteToPaintTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS palettepaintrels (
      id              SERIAL PRIMARY KEY,
      palette         INT REFERENCES palettes,
      paint           INT REFERENCES paints
    )
  `)
}

export async function addPaintToPalette(palette, paint) {
  return await pool.query(`
    INSERT INTO palettepaintrels (palette, paint) VALUES
    ($1, $2)
  `, [palette.id, paint.id])
}

export async function removePaintFromPalette(palette, paint) {
  return await pool.query(`
    DELETE FROM palettepaintrels
    WHERE palette = $1 AND paint = $2
  `, [palette.id, paint.id])
}

export async function clearPalette(palette) {
  pool.query(`
    UPDATE palettes SET createdat = CURRENT_TIMESTAMP, name = $2
    WHERE id = $1
  `, [palette.id, palette.name])
  return await pool.query(`
    DELETE FROM palettepaintrels
    WHERE palette = $1
  `, [palette.id])
} 

export async function delPalette(palette) {
  pool.query(`
    DELETE FROM palettepaintrels
    WHERE palette = $1
  `, [palette.id])
  return await pool.query(`
    DELETE FROM palettes
    WHERE id = $1
  `, [palette.id])
}

export async function getPalette(id) {
  const paletteInfo = await pool.query(`
    SELECT * FROM palettes
    WHERE id=$1
  `, [id])
  const queryRes = await pool.query(`
    SELECT * FROM palettepaintrels
    WHERE palette = $1
  `, [id])
  const res = queryRes.rows.reduce((acc, curr) => {
    acc.push(curr.paint)
    return acc;
  }, []);
  const paints = await Promise.all(res.map(async id => {
    const res2 = await pool.query(`
    SELECT * FROM paints
    WHERE id=$1
  `, [id])
    return res2.rows[0]
  }))
  const result = paletteInfo.rows[0]
  result.paints = paints
  return result
}

export async function getPalettesByUser(user) {
  const res = await pool.query(`
    SELECT * FROM palettes
    WHERE owner=$1
    ORDER BY createdAt DESC
  `, [user.id])
  return res.rows;
}

export async function getPaint(id) {
  const res = await pool.query(`
    SELECT * FROM paints
    WHERE id=$1
  `, [id])
  return res.rows[0]
}

export async function getPaints() {
  const res = await pool.query(`
    SELECT * FROM paints
  `)
  return res.rows;
}

export async function getPaintsByColor(color) {
  const res = await pool.query(`
    SELECT * FROM paints
    WHERE colorfamily=$1
  `, [color])
  return res.rows.reduce((acc, curr) => {
    const match = acc.filter(paint => paint.imgurl === curr.imgurl)[0];
    if (match !== undefined) {
      match.size[curr.id] = [curr.size, curr.price]
    } else {
      curr.size = {[curr.id]: [curr.size, curr.price]}
      acc.push(curr)
    }
    return acc;
  }, []);
}

export async function createUserToPaintTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS userpaintrels (
      id              SERIAL PRIMARY KEY,
      owner           INT REFERENCES users,
      paint           INT REFERENCES paints
    )
  `)
}

export async function addPaintToUser(user, paint) {
  return await pool.query(`
    INSERT INTO userpaintrels (owner, paint) VALUES
    ($1, $2)
  `, [user, paint])
}

export async function removePaintFromUser(user, paint) {
  return await pool.query(`
    DELETE FROM userpaintrels
    WHERE owner = $1 AND paint = $2
  `, [user, paint])
}

export async function getPaintsByUser(user) {
  const res = await pool.query(`
    SELECT * FROM userpaintrels
    WHERE owner=$1
  `, [user.id])
  return Promise.all(res.rows.map(async (rel) => {
    const paintRes = await pool.query(`
      SELECT * FROM paints
      WHERE id=$1
    `, [rel.paint])
    return paintRes.rows[0]
  }));
}

if (REFRESH) {
  await pool.query('DROP TABLE IF EXISTS users CASCADE')
  await createUserTable()

  await pool.query('DROP TABLE IF EXISTS paints CASCADE')
  await createPaintTable()
  await updatePaintTable()

  await pool.query('DROP TABLE IF EXISTS palettes CASCADE')
  await createPaletteTable()

  await pool.query('DROP TABLE IF EXISTS palettepaintrels CASCADE')
  await createPaletteToPaintTable()

  await pool.query('DROP TABLE IF EXISTS userpaintrels CASCADE')
  await createUserToPaintTable()
}