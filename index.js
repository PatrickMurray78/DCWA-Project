const express = require('express')
var bodyParser = require('body-parser')
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient
var path = require('path');
const { body, validationResult, check } = require('express-validator');

const app = express()
const port = 3000

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('views'));

// SQL Database config
var db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'geography',
    insecureAuth: true
});

var mongodb;
var expectedCategory = [[]];

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/views/overview.html")
})

// Called when the url is changed to /listCountries
app.get('/listCountries', (req, res) => {
    db.getConnection((err, connection) => {
        if (err) { // Could not connect to database, display error message
            console.log(err)
            res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
        }
        else { // Connected to database
            // Get all the country codes in database and store them in expectedCategory
            let sql = "SELECT co_code from country";
            db.query(sql, (err, result) => {
                if (err) {
                    throw err;
                }
                else {
                    for (let i = 0; i < result.length; i++) {
                        expectedCategory[i] = result[i].co_code;
                    }
                }
            })

            // Get all the data from the country table and store it in countryInfo
            sql = 'Select * FROM country'
            db.query(sql, (err, result) => {
                if (err) throw err;
                countryInfo = result;
                // Render countries and pass the countryInfo as a parameter
                res.render('countries', {
                    data: countryInfo
                });
            });
        }
        connection.release();
    });
})

// Called when the 'Add Country' button is clicked in countries.ejs
app.get('/addCountry', (req, res) => {
    // Render the addCountry view and pass initialised empty parameters
    res.render('addCountry', { errors: undefined, code: "", name: "", details: "Please enter Country Details" });
})

// Called when the 'Add' button is clicked in addCountry.ejs
app.post('/addCountry',
    [check('code').not().isIn(expectedCategory).withMessage("Error: Code already exists"), // Ensure country code doesn't already exist
    check('code').isLength({ min: 3 }).withMessage("Country Code must be 3 characters"), // Country code must be 3 characters minimum
    check('name').isLength({ min: 3 }).withMessage("Country Name must be  at least 3 characters")], // Country name must be 3 characters minimum
    (req, res) => {
        db.getConnection((err, connection) => {
            if (err) { // Could not connect to database, display error message
                res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
            }
            else { // Connected to database
                countryCode = req.body.code;
                var errors = validationResult(req)
                if (!errors.isEmpty()) { // There were errors
                    // Render the addCountry view and pass the errors and also the data user inputted as parameters
                    res.render("addCountry", { errors: errors.errors, code: req.body.code, name: req.body.name, details: req.body.details })
                } else { // There were no errors
                    console.log(req.body)
                    // Add a new country to the database
                    let sql = "INSERT INTO country (co_code, co_name, co_details) VALUES ('" + req.body.code + "', '" + req.body.name + "', '" + req.body.details + "');"
                    db.query(sql, (err, result) => {
                        if (err) throw err;
                    })
                    // Update the expectedCategory
                    sql = "SELECT co_code from country";
                    db.query(sql, (err, result) => {
                        for (let i = 0; i < result.length; i++) {
                            expectedCategory[i] = result[i].co_code;
                        }
                    })
                    res.redirect('/listCountries')
                }
            }
            connection.release();
        })
    })

// Called by the 'update' link in listCountries.ejs, passes the country code as parameter
app.get('/edit/:code', (req, res) => {
    db.getConnection((err, connection) => {
        if (err) { // Couldn't connect to database, display error message
            res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
        }
        else { // Connected to database
            // Get all details from country table where country code equals the country code passed as parameter
            let sql = "SELECT * FROM country WHERE co_code = '" + req.params.code + "'"
            db.query(sql, (err, result) => {
                if (err) throw err;
                // Render the edit view and pass initialised empty errors and also the country details as parameters
                res.render('edit', { errors: undefined, code: result[0].co_code, name: result[0].co_name, details: result[0].co_details })
            })
        }
        connection.release();
    })
})

// Called when the 'Update' button is clicked in edit.ejs
app.post('/edit',
    check('name').isLength({ min: 1 }).withMessage("Country Name is Mandatory!"), // Country name must be 1 character minimum
    (req, res) => {
        db.getConnection((err, connection) => {
            if (err) { // Couldn't connect to database, display error
                res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
            }
            else { // Connected to database
                var errors = validationResult(req)
                if (!errors.isEmpty()) { // There were errors
                    // Render the edit view and pass the errors and also the data user inputted as parameters
                    res.render("edit", { errors: errors.errors, code: req.body.code, name: req.body.name, details: req.body.details })
                } else { // There were no errors
                    // Update the country with the data the user input
                    let sql = "UPDATE country SET co_name = '" + req.body.name + "', co_details = '" + req.body.details + "' where co_code = '" + req.body.code + "';"
                    db.query(sql, (err, result) => {
                        if (err) throw err;
                    })
                    res.redirect('/listCountries')
                }
            }
            connection.release();
        })
    })

// Called by the 'Delete' link in listCountries.ejs, passes the country code as parameter
app.get('/delete/:code', (req, res) => {
    db.getConnection((err, connection) => {
        if (err) { // Couldn't connect to database
            res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
        }
        else { // Connected to database
            // Check if the country code passed as parameter has any cities
            let sql = "SELECT co_code FROM city WHERE co_code = '" + req.params.code + "'"
            db.query(sql, (err, result) => {
                if (err) throw err;
                if (result[0] == undefined) { // Country has no cities, so we then delete that country record from the country table
                    sql = "DELETE FROM country WHERE co_code = '" + req.params.code + "'"
                    db.query(sql, (err, result) => {
                        if (err) throw err;
                    })

                    // Update expectedCategory
                    sql = "SELECT co_code from country";
                    db.query(sql, (err, result) => {
                        for (let i = 0; i < result.length; i++) {
                            expectedCategory[i] = result[i].co_code;
                        }
                    })

                    res.redirect('/listCountries')
                }
                else { // Country has cities, render the delete view and display error message
                    res.render('delete', { code: req.params.code })
                }
            })
        }
        connection.release();
    })
})

// Called when the url is changed to /listCities
app.get('/listCities', (req, res) => {
    db.getConnection((err, connection) => {
        if (err) {
            // Couldn't connect to database, display error message
            res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
        }
        else { // Connected to database
            // Get all data from city table and store it in cityData
            let sql = 'Select * FROM city'
            db.query(sql, (err, result) => {
                if (err) throw err;
                // Render cities and pass the cityData as a parameter
                res.render('cities', {
                    cityData: result
                });
            });
        }
        connection.release();
    })
})

// Called by the 'All Details' link in allDetails.ejs, passes the city code as parameter
app.get('/allDetails/:cityCode', (req, res) => {
    db.getConnection((err, connection) => {
        if (err) { // Couldn't connect  to database, display error
            res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:3006</h2><a href='./overview.html'>Home</a>")
        }
        else { // Connected to database
            // Get all data from the city table and the country name from the country table
            let sql = "SELECT ci.*, co.co_name FROM city ci left join country co on co.co_code = ci.co_code WHERE cty_code = '" + req.params.cityCode + "'"
            db.query(sql, (err, result) => {
                if (err) throw err;
                // Render alldetails and pass the results are parameters
                res.render('alldetails', { cityCode: result[0].cty_code, coCode: result[0].co_code, cityName: result[0].cty_name, population: result[0].population, bySea: result[0].isCoastal, area: result[0].areaKM, country: result[0].co_name });
            })
        }
        connection.release();
    })
})

// Called when the url is changed to /listHeadsOfState
app.get('/listHeadsOfState', (req, res) => {
    MongoClient.connect('mongodb://localhost:27017/headsOfStateDB', function (err, client) {
        if (err) { // Could not connect to database
            res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:27017</h2><a href='./overview.html'>Home</a>")
        }
        else { // Connected to database
            mongodb = client.db('headsOfStateDB')

            // Get all the heads of state and corresponding country codes from the headsOfState collection
            mongodb.collection('headsOfState').find().toArray(function (err, result) {
                if (err) throw err;

                // Render headsofstate and pass the result as a parameter
                res.render('headsofstate', {
                    data: result
                });
            });
        }
    })
})

// Called when the 'Add Head Of State' button is clicked in listHeadsOfState.ejs
app.get('/addHeadOfState', (req, res) => {
    // Update expectedCategory
    sql = "SELECT co_code from country";
    db.query(sql, (err, result) => {
        for (let i = 0; i < result.length; i++) {
            expectedCategory[i] = result[i].co_code;
        }
    })
    // Render the addheadofstate view and pass initialised empty parameters
    res.render('addheadofstate', { errors: undefined, code: "", name: "" })
})

// Called when the 'Add' button is clicked in addheadOfState.ejs
app.post('/addHeadOfState',
    [check('code').isIn(expectedCategory).withMessage("Cannot add Head of State as this country is not in MySQL database"), // Ensure country code already exists
    check('code').isLength({ min: 3 }).withMessage("Country Code must be 3 characters"), // Country code must be 3 characters minimum
    check('name').isLength({ min: 3 }).withMessage("Head of State must be  at least 3 characters")], // Head of State must be 3 characters minimum
    (req, res) => {
        MongoClient.connect('mongodb://localhost:27017/headsOfStateDB', function (err, client) {
            if (err) { // Couldn't connect to database, display error message
                res.send("<h1>Error Message<h1><br><br><h2>Error: connect ECONNREFUSED 127.0.0.1:27017</h2><a href='./overview.html'>Home</a>")
            }
            else {
                var errorMessage = "Cannot add Head of State to " + req.body.code + " as this country is not in MySQL database"
                var errors = validationResult(req)
                if (!errors.isEmpty()) { // There are errors

                    res.render("addHeadOfState", { errors: errors.errors, code: req.body.code, name: req.body.name })
                } else { // There are no errors
                    mongodb.collection('headsOfState').find({ _id: req.body.code }).toArray(function (err, res) {
                        if (res[0] == undefined) {
                            // Add new Head of State to the collection
                            mongodb.collection('headsOfState').insert({
                                _id: req.body.code,
                                headOfState: req.body.name
                            })
                        }
                        else {
                            // Update existing Head of State
                            mongodb.collection('headsOfState').update({ _id: req.body.code }, { $set: { headOfState: req.body.name } })
                        }
                    })
                    res.redirect('/listHeadsOfState')
                }
            }
        })
    });

app.get('/index.js', function (req, res) {
    res.sendFile('index.js');
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
})