const express = require('express');
var cors = require('cors')
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');

var db = require('knex')({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: true,
    }
});

// var db = require('knex')({
//     client: 'pg',
//     connection: {
//         host: '127.0.0.1',
//         user: 'postgres',
//         password: '123456',
//         database: 'inspireme-db'
//     }
// });

console.log('--- TESTING DB ---');
// console.log(process.env);

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send('Getting root... Yam yam yam!');
});

//////////////////////////////
// --- LOGIN & REGISTER --- //
//////////////////////////////

app.post('/signin', (req, res) => {
    // console.log(req.body);
    const { name, password } = req.body;
    if (!name || !password) {
        res.status(400).json('Bad request params.');
        return;
    }

    db.select('id', 'password_hash').from('users').where('name', name)
        .then(user => {
            if (user.length) {
                if (bcrypt.compareSync(password, user[0].password_hash)) {
                    // Successful sign-in
                    res.status(200).json({ id: user[0].id, name: name });
                }
                else {
                    res.status(400).json('Wrong password');
                }
            }
            else
                res.status(400).json('User Name does not exist');
        })
        .catch(err => {
            console.log(err);
            res.status(400).json('Can not access user information');
        });
});

app.post('/register', (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        res.status(400).json('Bad request params');
        return;
    }

    // Hash the password
    const salt = bcrypt.genSaltSync(8);
    const hashedPassword = bcrypt.hashSync(password, salt);

    // Inserting into db:
    db('users')
        .returning(['id', 'name'])
        .insert({
            name: name,
            password_hash: hashedPassword,
            joined: new Date()
        })
        .then(user => {
            res.status(200).json(user[0]);
        })
        .catch(err => {
            console.log(err);
            if (err.constraint === 'Unique name') {
                res.status(400).json("User Name already exists");
            }
            else {
                res.status(400).json("Failed registration");
            }
        });
})

//////////////////////////////
// --- PROFILE --- //
//////////////////////////////

app.get('/profile/:id', (req, res) => {
    const { id } = req.params;
    db.select('*').from('users').where('id', id)
        .then(user => {
            if (user.length)
                res.json(user[0]);
            else
                res.status(400).json('User Not Found');
        })
        .catch(err => {
            console.log(err);
            res.status(400).json('Error while getting user');
        });
});

//////////////////////////////
// --- LIKES --- //
//////////////////////////////

// Handles liking of inspiration (+1)
app.post('/like', (req, res) => {
    const { userId, inspId } = req.body;
    if (!userId || !inspId) {
        res.status(400).json('Bad request params');
        return;
    }

    // Inserting into like table:
    db('likes')
        .returning('id')
        .insert({
            user_id: userId,
            insp_id: inspId,
            date: new Date()
        })
        .then(entry => {
            res.status(200).json('Successfuly updated the DB');
        })
        .catch(err => {
            console.log(err);
            if (err.constraint === 'Something') {
                res.status(400).json("Something happend at the server");
            }
            else {
                res.status(400).json("Failed liking inspiration: User or Inspiration id doesn't exist");
            }
        });

    // Update inspirations table likes column:
    db('inspirations')
        .where('id', '=', inspId)
        .increment('likes', 1)
        .catch(err => {
            console.log(err);
        });
})

// Handles DIS-liking of inspiration (-1)
app.post('/dislike', (req, res) => {
    const { userId, inspId } = req.body;
    if (!userId || !inspId) {
        res.status(400).json('Bad request params');
        return;
    }

    // Inserting into like table:
    db('likes')
        .returning(['id'])
        .where({
            user_id: userId,
            insp_id: inspId
        })
        .del()
        .then(entry => {
            res.status(200).json('Successfuly updated the DB');
        })
        .catch(err => {
            console.log(err);
            if (err.constraint === 'Something') {
                res.status(400).json("Something happend at the server");
            }
            else {
                res.status(400).json("Failed liking inspiration");
            }
        });

    // Update inspirations table likes column:
    db('inspirations')
        .where('id', '=', inspId)
        .decrement('likes', 1)
        .catch(err => {
            console.log(err);
        });
})



//////////////////////////////
// --- INSPIRATIONS --- //
//////////////////////////////

const allowedTypes = ['video', 'image', 'page'];

function QueryException(message) {
    this.message = message;
    this.name = 'QueryException';
}

function getOrderColAndDir(order) {
    let orderCol = 'likes', orderDir = 'desc';    // Default OrderBy
    if (order) {
        orderBy = order.split('_');
        if (orderBy.length === 2) {
            orderCol = orderBy[0];
            orderDir = orderBy[1];
        }
    }
    return [orderCol, orderDir];
}

function onlyLikedInspirations({ tags, type, order, curUser }) {
    console.log(tags, type, order, curUser);

    // Figuring out the OrderBy query
    const [orderCol, orderDir] = getOrderColAndDir(order);
 
    // SELECT insp.*, users.name as uploaderName, 1 as inspiredByMe
    // FROM likes 
    // INNER JOIN inspirations as insp ON likes.insp_id = insp.id
    // INNER JOIN users ON insp.user_id = users.id
    // WHERE likes.user_id = 49
    return db.select('insp.*', { uploaderName: 'users.name', likedByMe: 'users.id'}).from('likes')
        .innerJoin({insp: 'inspirations'}, 'likes.insp_id', 'insp.id')
        .innerJoin('users', 'insp.user_id', 'users.id')
        .where(builder => {
            builder.where('likes.user_id', Number(curUser));
            if (type) {
                if (allowedTypes.includes(type))
                    builder.where('type', type);
                else
                    throw new QueryException('Found no matching inspirations with the given type: ' + type);
            }
            if (tags) {
                const tagsArr = tags.split(' ').join('').split(',');
                let queryTags = '(';
                tagsArr.forEach(() => {
                    queryTags += '? = ANY (tags) and '
                });
                queryTags = queryTags.slice(0, -4); // Removing last 4 chars that contain the last 'or'
                queryTags += ')';
                // Checking the resulting query:
                const fullQuery = builder.whereRaw(queryTags, tagsArr).toSQL().toNative();
                console.log(fullQuery);
            }
        })
        .orderBy(orderCol, orderDir)
        // limit - number of returned rows, offset - how many rows to skip beforehand (OrderBy is a must for consistency)
        .limit(24).offset(0)
        .then(inspirations => {
            if (inspirations.length)
                return inspirations;
            else
                throw new QueryException('No matching inspirations for the query');
        })
        .catch(err => {
            console.log(err);
            if (err instanceof QueryException)
                throw err;
            else
                throw new QueryException('Error while getting inspirations.');
        });
}

app.get('/inspirations', (req, res) => {
    console.log('Query params: ', req.query);

    const curUser = req.query.curUser ? req.query.curUser : 0; // The number 0 will not match any users on the liked table
    const onlyLiked = req.query.onlyLiked ? true : false;

    // In case we want only inspirations liked by current user
    if (curUser !== 0 && onlyLiked) {
        onlyLikedInspirations(req.query).then(inspirations => {
            res.status(200).json(inspirations);
        })
        .catch(err => {
            res.status(400).json('No matching inspirations for the query');
        }); 
        return;
    }

    // Figuring out the OrderBy query
    const [orderCol, orderDir] = getOrderColAndDir(req.query.order);

    // Building query with params recieved by req.query
    db.select('i.*', { uploaderName: 'u.name', likedByMe: 't3.id' }).from({ i: 'inspirations' })
        .where(builder => {
            if (req.query.hasOwnProperty('type')) {
                if (allowedTypes.includes(req.query.type))
                    builder.where('type', req.query.type);
                else
                    throw new QueryException('Found no matching inspirations with the given type: ' + req.query.type);
            }
            if (req.query.hasOwnProperty('tags')) {
                const tagsArr = req.query.tags.split(' ').join('').split(',');
                let queryTags = '(';
                tagsArr.forEach(() => {
                    queryTags += '? = ANY (tags) and '
                });
                queryTags = queryTags.slice(0, -4); // Removing last 4 chars that contain the last 'or'
                queryTags += ')';
                // Checking the resulting query:
                const fullQuery = builder.whereRaw(queryTags, tagsArr).toSQL().toNative();
                console.log(fullQuery);
            }
        })
        .innerJoin({ u: 'users' }, 'i.user_id', 'u.id')
        .leftJoin(db.select('*').from('likes').where('user_id', Number(curUser)).as('t3'), function () {
            this.on('i.id', '=', 't3.insp_id');
        })
        .orderBy(orderCol, orderDir)
        // limit - number of returned rows, offset - how many rows to skip beforehand (OrderBy is a must for consistency)
        .limit(24).offset(0)
        .then(inspirations => {
            if (inspirations.length)
                res.status(200).json(inspirations);
            else
                res.status(400).json('No matching inspirations for the query');
        })
        .catch(err => {
            console.log(err);
            if (err instanceof QueryException)
                res.status(400).json(err.message);
            else
                res.status(400).json('Error while getting inspirations.');
        });
});

app.post('/inspirations', (req, res) => {
    // console.log('Post body: ', req.body);
    const { title, source, image, userId, tags, type } = req.body;
    // Inserting into db:
    db('inspirations')
        .returning('*')
        .insert({
            title: title,
            source: source,
            image: image,
            type: type,
            tags: '{' + tags + '}',
            user_id: userId,
            added: new Date()
        })
        .then(response => {
            res.status(200).json("Inspiration successfully uploaded.");
        })
        .catch(err => {
            console.log(err);
            res.status(400).json("Failed uploading inspiration.");
        });
});

app.post('/check/content-type', (req, res) => {
    const { url } = req.body;
    fetch(url, {
        method: 'get'
    })
        .then(response => {
            // console.log(response.status, response.headers, response.headers.get('content-type'));
            res.status(response.status).json({contentType: response.headers.get('content-type'), status: response.status});
        })
        .catch(error => {
            console.log('Error:', error);
            res.status(404).json('Could not fetch resource');
        });
});

/////////////////////////////////
// --- STARTING THE SERVER --- //
/////////////////////////////////

app.listen(process.env.PORT || 3001, () => {
    console.log('Server is running on port 3001 or PORT:', process.env.PORT);
});