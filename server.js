const express = require('express');
const bodyParser = require('body-parser');

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

app.get('/', (req, res) => {
    res.send('Getting root...');
});

//////////////////////////////
// --- LOGIN & REGISTER --- //
//////////////////////////////

app.post('/signin', (req, res) => {
    console.log(req.body);
    if (req.body.email === db.users[0].email && req.body.password === db.users[0].password)
        res.json('Success');
    else
        res.json('Failure');
});

app.post('/register', (req, res) => {
    const { email, name, password } = req.body;
    // Inserting into db:
    db('users')
        .returning('*')
        .insert({
            email: email,
            name: name,
            joined: new Date()
        })
        .then(response => {
            res.json(response);
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

const allowedTypes = ['video', 'image', 'page'];

function QueryException(message) {
    this.message = message;
    this.name = 'QueryException';
 }

app.get('/inspirations', (req, res) => {
    console.log('Query params: ',req.query);
    
    db.select('*').from('inspirations')
    .where(builder => {
        if (req.query.hasOwnProperty('type')) {
            if (allowedTypes.includes(req.query.type))
                builder.where('type', req.query.type);
            else
                throw new QueryException('Found no matching inspirations with the given type: ' + req.query.type);
        }
        if (req.query.hasOwnProperty('tags')) {
            let query_tags = '';
            const tags_arr = req.query.tags.split(',');
            tags_arr.forEach(() => {
                query_tags += '? = ANY (tags) or '
            });
            query_tags = query_tags.slice(0, -4); // Removing last 4 chars that contain the last 'or'
            const full_query = builder.whereRaw(query_tags, tags_arr).toSQL().toNative();
            console.log(full_query); // Checking the resulting query
        }
    })
    .then(inspirations => {
        if (inspirations.length)
            res.json(inspirations);
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

// app.get('/inspirations', (req, res) => {
//     console.log(req.query);

//     db.select('*').from('inspirations')
//     .then(inspirations => {
//         if (inspirations.length)
//             res.json(inspirations);
//         else
//             res.status(400).json('Found no inspirations with type: ' + type);
//     })
//     .catch(err => {
//         console.log(err);
//         res.status(400).json('Error while getting inspirations');
//     });
// });

// app.get('/inspirations/:type', (req, res) => {
//     const { type } = req.params;
//     db.select('*').from('inspirations').where('type', type)
//         .then(inspirations => {
//             if (inspirations.length)
//                 res.json(inspirations);
//             else
//                 res.status(400).json('Found no inspirations with type: ' + type);
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(400).json('Error while getting inspirations');
//         });
// });

// app.get('/inspirations/:type', (req, res) => {
//     const { type } = req.params;
//     db.select('*').from('inspirations').where('type', type)
//         .then(inspirations => {
//             if (inspirations.length)
//                 res.json(inspirations);
//             else
//                 res.status(400).json('Found no inspirations with type: ' + type);
//         })
//         .catch(err => {
//             console.log(err);
//             res.status(400).json('Error while getting inspirations');
//         });
// });

/////////////////////////////////
// --- STARTING THE SERVER --- //
/////////////////////////////////

app.listen(3001, () => {
    console.log('Server is running on port 3001.');
});

/* Server functions:
GET / --> "Getting root..."
POST /register --> V: user / X: error msg
POST /sign-in --> V: user / X: error msg
GET /profile/:id --> user

*/