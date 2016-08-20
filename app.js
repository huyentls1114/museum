var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');
var session = require("express-session");
var LocalStrategy = require("passport-local").Strategy;
var MongoStore = require('connect-mongo')(session);
var acl = require('acl');

var app = express();

global.myCustomVars = {};

var configDB = require('./config/database');
var mongooseConnection = mongoose.connect(configDB.url);
require('./models/User.js')(mongoose);
require('./models/Animal.js')(mongoose);
require('./models/Log.js')(mongoose);
require('./config/passport')(passport, mongoose.model('User'));


require('./init');

/**
 * Use routers
 */

var users = require('./routes/users');
var auth = require('./routes/auth');
var angular = require('./routes/angular');
var content = require('./routes/content');
var log = require('./routes/log.js');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
	secret: "SecretKeyMy",
	resave: true,
	saveUninitialized: true,
	store: new MongoStore({mongooseConnection: mongoose.connection})
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(function (req, res, next) {
	console.log(req.session);
	if ('user' in req){
		console.log(req.user);
	}
	next();
})

var routes = require('./routes/index');
app.use('/', routes);

app.use('/users', users);
app.use('/auth', auth);
app.use('/app', angular);
app.use('/content', content);
app.use('/log', log);

console.log('Server started at port 8000');

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});


module.exports = app;
