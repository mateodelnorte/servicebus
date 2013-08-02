var Serializer = require('./serializer');

function QueueRegistry () {
  this.serializer = new Serializer();
  this.queues = {};
}

QueueRegistry.prototype.getCurrentQueues = function getCurrentQueues (callback) {
  if ( ! this.queues || JSON.stringify(this.queues) === "{}") {
    var self = this;
    this.serializer.on('deserialized', function (queues) {
      self.queues = queues;
      callback(null, queues)
    });
    this.serializer.deserialize();
  } else {
    callback(null, this.queues);
  }
};

QueueRegistry.prototype.setCurrentQueues = function setCurrentQueues (queues, callback) {
  this.queues = queues;
  this.serializer.serialize(queues, callback);
}

module.exports = QueueRegistry;