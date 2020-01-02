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

// db('users').insert({
//     email: 'test2@gmail.com',
//     name: 'test user 2',
//     joined: new Date()
// }).then(console.log);

// db.select().from('users').then(data => {
//     console.log(data);
// });

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Getting root...');
});

app.post('/signin', (req, res) => {
    console.log(req.body);
    if (req.body.email === db.users[0].email && req.body.password === db.users[0].password)
        res.json('Success');
    else
        res.json('Failure');
});

app.post('/register', (req, res) => {
    const { email, name, password } = req.body;
    // Insert into db
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
            res.status(400).json("Failed registration.");
        });
})

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
            res.status(400).json('Error while getting user');
        });
});

app.listen(3001, () => {
    console.log('Server is running on port 3001.');
});

/* Server functions:
GET / --> "Getting root..."
POST /register --> V: user / X: error msg
POST /sign-in --> V: user / X: error msg
GET /profile/:id --> user

*/

// app.post('/profile', (req, res) => {
//     console.log(req.body);
//     res.send("Got your posted user... Success!");
// });

// app.get('/profile', (req, res) => {
//     res.send('<h2>Getting profile...</h2>');
// });

// app.get('/', (req, res) => {
//     const user = {
//         name: "Roger Biano",
//         Hobby: "Swimming"
//     }
//     res.send(user);
//     //res.send('<h2>Hello!</h2>');
// });