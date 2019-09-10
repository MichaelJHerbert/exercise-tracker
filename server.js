const express = require('express');
const app = express();
const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');
const Exercise = require('./models/Exercise');

// Connect to Database
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useCreateIndex: true
  })
  .then(() => {
    console.log('MongoDB Connected...');
  })
  .catch(err => console.log(err));

// Middleware
app.use(cors());
app.use(express.urlencoded());
app.use(express.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res
    .status(errCode)
    .type('txt')
    .send(errMessage);
  next();
});

// @route POST api/exercise/new-user
// @desc Get & store new user in database
// @access Public
app.post('/api/exercise/new-user', function(req, res) {
  const { username } = req.body;
  const newUser = new User({
    userId: Math.floor(Math.random() * 100000),
    username
  });
  User.findOne({ username }, function(err, data) {
    if (err) {
      res.json({ Error: err.message });
    } else if (data === null) {
      // Add user to database
      newUser
        .save()
        .then(item => {
          res.json({ userId: item.userId, username: item.username });
        })
        .catch(err => {
          res.json({ Error: err.message });
        });
    } else {
      // User already exists
      res.json({ Error: 'Username already exists' });
    }
  });
});

// @route POST api/exercise/add
// @desc Store new exercise with associated userId in database
// @access Public
app.post('/api/exercise/add', function(req, res) {
  // Validate form date
  // Check to see if date has been entered; set date to current date if it has not
  let date = !req.body.date ? new Date() : new Date(req.body.date);
  if (date instanceof Date && isNaN(date)) {
    res.json({ Error: 'Please enter valid date in format [YYYY-MM-DD]' });
  } else {
    // Validate form duration
    const { duration, userId, description } = req.body;
    if (isNaN(duration)) {
      res.json({
        Error: 'Please enter numeric duration value in minutes'
      });
    }

    const newExercise = new Exercise({
      userId,
      description,
      duration,
      date
    });

    // Create new exercise
    // Check if user exists
    User.findOne({ userId }, function(err, data) {
      if (err) {
        res.json({ Error: err.message });
      } else if (data === null) {
        // User does not exist
        res.json({ Error: 'User does not exist' });
      } else {
        // Add exercise to database
        newExercise.save().then(item => {
          res.json({
            userId: item.userId,
            username: data.username,
            description: item.description,
            duration: item.duration,
            date: `${item.date.getDate()}/${item.date.getMonth() +
              1}/${item.date.getFullYear()}`
          });
        });
      }
    });
  }
});

// @route GET api/exercise/users
// @desc Get array of all users
// @access Public
app.get('/api/exercise/users', function(req, res) {
  User.find({})
    .then(data => {
      res.json(data);
    })
    .catch(err => {
      res.json({ Error: err.message });
    });
});

// @route GET api/exercise/log?
// @desc Get user exercise data based on query input parameters
// @access Public
app.get('/api/exercise/log?', function(req, res) {
  const { userId, from, to, limit } = req.query;
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const checkUser = User.findOne({ userId });
  const checkExercises = Exercise.find({ userId }).sort({ date: 1 });

  // Check to see if user exists
  checkUser
    .then(user => {
      const userName = user.username;
      // Check to see if dates have been specified
      if (!from && !to) {
        if (limit) {
          // Dates not specified but limit specified
          // Find logged exercises
          Exercise.find({ userId })
            .limit(Number(limit))
            .sort({ date: 1 })
            .exec()
            .then(data => {
              res.json({
                username: userName,
                userId,
                count: data.length,
                exerciseLogs: data.map(item => {
                  return {
                    description: item.description,
                    duration: item.duration,
                    date: `${item.date.getDate()}/${item.date.getMonth() +
                      1}/${item.date.getFullYear()}`
                  };
                })
              });
            })
            .catch(err => {
              return res.json({ Error: err.message });
            });
        } else {
          // Dates not specified and limit specified
          // Find logged exercises
          checkExercises
            .then(exercises => {
              res.json({
                username: userName,
                userId,
                count: exercises.length,
                exerciseLogs: exercises.map(item => {
                  return {
                    description: item.description,
                    duration: item.duration,
                    date: `${item.date.getDate()}/${item.date.getMonth() +
                      1}/${item.date.getFullYear()}`
                  };
                })
              });
            })
            .catch(err => {
              return res.json({ Error: err.message });
            });
        }
      }

      // Check if only from date has been entered
      if (fromDate instanceof Date && !isNaN(fromDate) && !to) {
        // Only from date is specified
        // Check for limit
        if (limit) {
          // Find specific logged exercises
          Exercise.find({ userId, date: { $gte: fromDate } })
            .limit(Number(limit))
            .sort({ date: 1 })
            .exec()
            .then(data => {
              // Exercises found ...
              const currentDate = new Date();
              const responseData = data.map(item => {
                return {
                  description: item.description,
                  duration: item.duration,
                  date: `${item.date.getDate()}/${item.date.getMonth() +
                    1}/${item.date.getFullYear()}`
                };
              });
              res.json({
                username: userName,
                userId,
                dateFrom: `${fromDate.getDate()}/${fromDate.getMonth() +
                  1}/${fromDate.getFullYear()}`,
                dateTo: `${currentDate.getDate()}/${currentDate.getMonth() +
                  1}/${currentDate.getFullYear()}`,
                count: data.length,
                exerciseLogs: responseData
              });
            })
            .catch(err => {
              res.json({ Error: err.message });
            });
        } else {
          // Limit not specified
          // Find logged exercises
          Exercise.find({ userId, date: { $gte: fromDate } })
            .sort({ date: 1 })
            .exec()
            .then(data => {
              // Exercises found ...
              const currentDate = new Date();
              const responseData = data.map(item => {
                return {
                  description: item.description,
                  duration: item.duration,
                  date: `${item.date.getDate()}/${item.date.getMonth() +
                    1}/${item.date.getFullYear()}`
                };
              });
              res.json({
                username: userName,
                userId,
                dateFrom: `${fromDate.getDate()}/${fromDate.getMonth() +
                  1}/${fromDate.getFullYear()}`,
                dateTo: `${currentDate.getDate()}/${currentDate.getMonth() +
                  1}/${currentDate.getFullYear()}`,
                count: data.length,
                exerciseLogs: responseData
              });
            })
            .catch(err => {
              res.json({ Error: err.message });
            });
        }
      }

      // Check if only to date has been entered
      if (toDate instanceof Date && !isNaN(toDate) && !from) {
        // Only to date is specified
        // Check for limit
        if (limit) {
          // Find specific logged exercises
          Exercise.find({ userId, date: { $lte: toDate } })
            .limit(Number(limit))
            .sort({ date: 1 })
            .exec()
            .then(data => {
              // Exercises found ...
              const responseData = data.map(item => {
                return {
                  description: item.description,
                  duration: item.duration,
                  date: `${item.date.getDate()}/${item.date.getMonth() +
                    1}/${item.date.getFullYear()}`
                };
              });
              res.json({
                username: userName,
                userId,
                dateTo: `${toDate.getDate()}/${toDate.getMonth() +
                  1}/${toDate.getFullYear()}`,
                count: data.length,
                exerciseLogs: responseData
              });
            })
            .catch(err => {
              res.json({ Error: err.message });
            });
        } else {
          // Limit not specified
          // Find logged exercises
          Exercise.find({ userId, date: { $lte: toDate } })
            .sort({ date: 1 })
            .exec()
            .then(data => {
              // Exercises found ...
              const responseData = data.map(item => {
                return {
                  description: item.description,
                  duration: item.duration,
                  date: `${item.date.getDate()}/${item.date.getMonth() +
                    1}/${item.date.getFullYear()}`
                };
              });
              res.json({
                username: userName,
                userId,
                dateTo: `${toDate.getDate()}/${toDate.getMonth() +
                  1}/${toDate.getFullYear()}`,
                count: data.length,
                exerciseLogs: responseData
              });
            })
            .catch(err => {
              res.json({ Error: err.message });
            });
        }
      }

      // Check 2 valid dates have been entered
      if (
        fromDate instanceof Date &&
        !isNaN(fromDate) &&
        toDate instanceof Date &&
        !isNaN(toDate)
      ) {
        if (limit) {
          // Limit specified
          // Find specific logged exercises
          Exercise.find({ userId, date: { $gte: fromDate, $lte: toDate } })
            .limit(Number(limit))
            .sort({ date: 1 })
            .exec()
            .then(data => {
              // Exercises found ...
              const responseData = data.map(item => {
                return {
                  description: item.description,
                  duration: item.duration,
                  date: `${item.date.getDate()}/${item.date.getMonth() +
                    1}/${item.date.getFullYear()}`
                };
              });
              res.json({
                username: userName,
                userId,
                dateFrom: `${fromDate.getDate()}/${fromDate.getMonth() +
                  1}/${fromDate.getFullYear()}`,
                dateTo: `${toDate.getDate()}/${toDate.getMonth() +
                  1}/${toDate.getFullYear()}`,
                count: data.length,
                exerciseLogs: responseData
              });
            })
            .catch(err => {
              res.json({ Error: err.message });
            });
        } else {
          // Limit not specified
          // Find logged exercises
          Exercise.find({ userId, date: { $gte: fromDate, $lte: toDate } })
            .sort({ date: 1 })
            .exec()
            .then(data => {
              // Exercises found ...
              const responseData = data.map(item => {
                return {
                  description: item.description,
                  duration: item.duration,
                  date: `${item.date.getDate()}/${item.date.getMonth() +
                    1}/${item.date.getFullYear()}`
                };
              });
              res.json({
                username: userName,
                userId,
                dateFrom: `${fromDate.getDate()}/${fromDate.getMonth() +
                  1}/${fromDate.getFullYear()}`,
                dateTo: `${toDate.getDate()}/${toDate.getMonth() +
                  1}/${toDate.getFullYear()}`,
                count: data.length,
                exerciseLogs: responseData
              });
            })
            .catch(err => {
              res.json({ Error: err.message });
            });
        }
      }

      // Check for invalid date if date parameters have been entered
      if (
        (from && (fromDate instanceof Date && isNaN(fromDate))) ||
        (to && toDate instanceof Date && isNaN(toDate))
      ) {
        res.json({ Error: 'Please enter valid date' });
      }
    })
    .catch(err => {
      return res.json({ Error: err.message });
    });
});

// Not found middleware
app.use((req, res, next) => {
  res.json({ status: 404, message: 'not found' });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('App listening on port ' + listener.address().port);
});
