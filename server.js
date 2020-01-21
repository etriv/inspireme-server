const express = require('express');
var cors = require('cors')
const bcrypt = require('bcryptjs');

var db = require('knex')({
    client: 'pg',
    connection: {
        host: '127.0.0.1',
        user: 'postgres',
        password: '123456',
        database: 'inspireme-db'
    }
});

console.log('--- TESTING DB ---');

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

    db.select('id', 'password_hash').from('users').where('name', name)
        .then(user => {
            if (user.length) {
                if (bcrypt.compareSync(password, user[0].password_hash)) {
                    res.status(200).json('Successful sign-in. Welcome ' + name + '.');
                }
                else {
                    res.status(400).json('Error: Password not matching.');   
                }
            }
            else
                res.status(400).json('Error: User name not found.');
        })
        .catch(err => {
            console.log(err);
            res.status(400).json('Error: Can not access user information.');
        });
});

app.post('/register', (req, res) => {
    const { name, password } = req.body;

    // Hash the password
    const salt = bcrypt.genSaltSync(8);
    const hashed_password = bcrypt.hashSync(password, salt);

    // Inserting into db:
    db('users')
        .returning(['id', 'name'])
        .insert({
            name: name,
            password_hash: hashed_password,
            joined: new Date()
        })
        .then(user => {
            res.status(200).json(user[0]);
        })
        .catch(err => {
            console.log(err);
            res.status(400).json("Failed registration.");
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
// --- INSPIRATIONS --- //
//////////////////////////////

const allowed_types = ['video', 'image', 'page'];

function QueryException(message) {
    this.message = message;
    this.name = 'QueryException';
 }

app.get('/inspirations', (req, res) => {
    console.log('Query params: ',req.query);

    // Figuring out the OrderBy query
    let order_col = 'likes', order_dir = 'desc';    // Default OrderBy
    if (req.query.hasOwnProperty('order')) {
        order_by = req.query.order.split('_');
        if (order_by.length === 2) {
            order_col = order_by[0];
            order_dir = order_by[1];
        }
    }
    
    db.select('i.*', {user_name: 'u.name'}).from({i: 'inspirations'})
    .where(builder => {
        if (req.query.hasOwnProperty('type')) {
            if (allowed_types.includes(req.query.type))
                builder.where('type', req.query.type);
            else
                throw new QueryException('Found no matching inspirations with the given type: ' + req.query.type);
        }
        if (req.query.hasOwnProperty('tags')) {
            const tags_arr = req.query.tags.split(' ').join('').split(',');
            let query_tags = '(';
            tags_arr.forEach(() => {
                query_tags += '? = ANY (tags) and '
            });
            query_tags = query_tags.slice(0, -4); // Removing last 4 chars that contain the last 'or'
            query_tags += ')';
            // Checking the resulting query:
            const full_query = builder.whereRaw(query_tags, tags_arr).toSQL().toNative();
            console.log(full_query); 
        }
    })
    .innerJoin({u: 'users'}, 'i.user_id', 'u.id')
    .orderBy(order_col, order_dir)
    // limit - number of returned rows, offset - how many rows to skip beforehand (OrderBy is a must for consistency)
    .limit(12).offset(0)                                   
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
    console.log('Post body: ',req.body);
    const { title, source, image, user_id, tags, type } = req.body;
    // Inserting into db:
    db('inspirations')
        .returning('*')
        .insert({
            title: title,
            source: source,
            image: image,
            type: type,
            tags: '{' + tags + '}',
            user_id: user_id,
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

/////////////////////////////////
// --- STARTING THE SERVER --- //
/////////////////////////////////

app.listen(3001, () => {
    console.log('Server is running on port 3001.');
});

/* 
Server functions:
GET / --> "Getting root..."
POST /register --> V: user / X: error msg
POST /sign-in --> V: user / X: error msg
GET /profile/:id --> user
*/

// *** Old code to handle the existence of a Types table
// // Mapping TYPES to thier corrsponding ID
// // types is being used later to build queries
// let types = {};
// db.select('*').from('types').then(result => {
//     console.log(result);
//     result.forEach(row => {
//         types[row.type] = row.id;
//     });
//     console.log(types);
// });

// app.get('/inspirations', (req, res) => {
//     console.log(req.query);

//     db.select('*').from('inspirations')
//     .where(builder => {
//         if (req.query.hasOwnProperty('type') && types.hasOwnProperty(req.query.type)) {
//             builder.where('type', types[req.query.type])
//         }
//     })
//     .then(inspirations => {
//         if (inspirations.length)
//             res.json(inspirations);
//         else
//             res.status(400).json('Found no matching inspirations');
//     })
//     .catch(err => {
//         console.log(err);
//         res.status(400).json('Error while getting inspirations');
//     });
// });