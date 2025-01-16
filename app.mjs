import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import * as auth from './auth.mjs';
import * as db from './db.mjs';

const app = express();

app.set('view engine', 'hbs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
	secret: 'secret',
	resave: false,
	saveUninitialized: true
}))

const authRequiredPaths = ['/profile', '/profile/my-paints']

app.use((req, res, next) => {
  if(authRequiredPaths.includes(req.path)) {
    if(!req.session.user) {
      res.redirect('/login'); 
    } else {
      next(); 
    }
  } else {
    next(); 
  }
});

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get("/", async (req, res) => {
	if (req.query.logout === 'true') {
		try {
			await auth.endAuthenticatedSession(req);
		} catch (err) {
			console.log(err)
		}
	}
	if (req.query.palette === 'new') {
		req.session.palette = { paints: [] };
	} else if (req.query.palette !== undefined) {
		const palette = await db.getPalette(req.query.palette);
		if (req.session.user !== undefined && req.session.user.id === palette.owner) {
			req.session.palette = palette;
		} else {
			res.redirect('/login')
			return
		}
	}
	res.render("home", { loggedIn: req.session && Object.hasOwn(req.session, 'user'), style: "index" });
})

app.get("/home", (req, res) => {
	res.redirect("/")
})

app.get("/login", (req, res) => {
	res.render("login", { loggedIn: req.session && Object.hasOwn(req.session, 'user'), style: "login", failure: req.query.auth === 'failed' })
})

app.post("/login", async (req, res) => {
	try {
		const user = await db.login(
			req.body.identifier,
			req.body.password
		)
		const currentPalette = req.session.palette;
		await auth.startAuthenticatedSession(req, user);
		if (currentPalette) {
			req.session.palette = currentPalette
		}
		res.redirect("/profile");
	} catch (err) {
		console.log(err);
		res.redirect("/login?auth=failed")
	}
})

app.get("/register", (req, res) => {
	res.render("register", { loggedIn: req.session && Object.hasOwn(req.session, 'user'), style: "login" })
})

app.post("/register", async (req, res) => {
	try {
		const newUser = await db.register(
			req.body.username,
			req.body.email,
			req.body.password
		)
		const currentPalette = req.session.palette;
		await auth.startAuthenticatedSession(req, newUser);
		if (currentPalette) {
			req.session.palette = currentPalette
		}
		res.redirect("/");
	} catch(err) {
		console.log(err);
	}
})

app.get("/profile", (req, res) => {
	res.render("profile", { loggedIn: req.session && Object.hasOwn(req.session, 'user'), style: "profile", user: req.session.user })
})

app.get("/profile/my-paints", (req, res) => {
	res.render("mypaints", { loggedIn: req.session && Object.hasOwn(req.session, 'user'), style: "mypaints", user: req.session.user })
})

app.get("/current-palette", async (req, res) => {
	if (req.session.palette === undefined) {
		req.session.palette = { paints: [] }
	}
	res.json({palette: req.session.palette});
})

// MAKE SURE AUTHENTICATION FOR THIS IS OK; COULD BE FINE B/C IT PUSHES TO CURRENT PALETTE
app.post("/current-palette", async (req, res) => {
	if (req.body.do === 'add-paint') {
		const paint = await db.getPaint(req.body.paint)
		req.session.palette.paints.push(paint);
		res.json(paint)
	} else if (req.body.do === 'save-palette') {
		if (!req.session.user) {
			res.sendStatus(401)
			return
		}
		const palette = Object.hasOwn(req.session.palette, 'id') ? req.session.palette : await db.createPalette({ userId: req.session.user.id, name: req.body.name});
		palette.name = req.body.name;
		const paints = req.session.palette.paints;
		db.clearPalette(palette);
		paints.forEach(paint => {
			db.addPaintToPalette(palette, paint);
		})
		req.session.palette = await db.getPalette(palette.id)
		res.sendStatus(200)
	} else {
		res.sendStatus(400)
	}
})

// Does not quite work yet
app.delete("/current-palette", async (req, res) => {
		const paint = await db.getPaint(req.body.paint)
		if (paint) {
			// Remove paint from session palette
			const paintsById = req.session.palette.paints.map(paint => paint.id)
			req.session.palette.paints.splice(paintsById.indexOf(paint.id), 1)
			res.json(paint)
		} else {
			res.sendStatus(404)
		}
})

app.get("/paints", async (req, res) => {
	if (req.query.colorfamily) {
		const paints = await db.getPaintsByColor(req.query.colorfamily);
		res.json({paints: paints})
	} else {
		const paints = await db.getPaints()
		res.json({paints: paints})
	}
})

app.get("/user/paints", async(req, res) => {
	if (!req.session.user) {
		res.sendStatus(401)
		return
	}
	const paints = await db.getPaintsByUser(req.session.user)
	const filteredPaints = req.query.filter ? paints.filter(paint => paint.color.toLowerCase().includes(req.query.filter.toLowerCase())) : paints
	res.json({ paints: filteredPaints })
})

app.post("/user/paints", async(req, res) => {
	if (!req.session.user) {
		res.sendStatus(401)
	}
	db.addPaintToUser(req.session.user.id, req.body.paint);
	res.sendStatus(200)
})

app.delete("/user/paints/:id", async(req, res) => {
	const id = req.params.id;
	if (!req.session.user) {
		res.sendStatus(401)
	}
	await db.removePaintFromUser(req.session.user.id, id)
	res.sendStatus(200)
})

app.get("/user/palettes", async (req, res) => {
	if (!req.session.user) {
		res.sendStatus(401);
		return
	}
	const palettes = await db.getPalettesByUser(req.session.user);
	const filteredPalettes = req.query.filter ? palettes.filter(palette => palette.name.toLowerCase().includes(req.query.filter.toLowerCase())) : palettes
	res.json({ palettes: filteredPalettes })
})

app.delete("/user/palettes/:id", async (req, res) => {
	const id = req.params.id;
	const palette = await db.getPalette(id);
	if (req.session.user && palette.owner === req.session.user.id) {
		await db.delPalette(palette);
		res.sendStatus(200)
	} else {
		res.sendStatus(401)
	}
})

app.listen(process.env.PORT || 3000);
