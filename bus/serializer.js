var events = require('events'),
    fs = require('fs'),
    util = require('util');

// TODO: enable specifying an arbitrary filename

function Serializer () {
  this.filename = process.cwd() + '/.queues';
  events.EventEmitter.call(this);
}

util.inherits(Serializer, events.EventEmitter);

Serializer.prototype.deserialize = function deserialize() {
  var self = this;
  fs.readFile(this.filename, function (err, data) {
    if (err) {
      self.emit('deserialized', {})
    } else {
      self.emit('deserialized', JSON.parse(data));
    }
  });
};

Serializer.prototype.serialize = function serializer(queues, callback) {
  fs.writeFile(this.filename, JSON.stringify(queues), 'utf-8', function (err) {
    if (err) callback(err);
    else callback();
  });
}

module.exports = Serializer;