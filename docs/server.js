
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.use(express.static(path.join(__dirname, '../node_modules/reveal.js')));
app.use(express.static(path.join(__dirname)));

http.createServer(app).listen(app.get('port'), function(){
  console.log('presentation server listening on port ' + app.get('port'));
});
