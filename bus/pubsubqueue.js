var events = require('events'),
    newId = require('node-uuid').v4,
    Serializer = require('./serializer'),
    util = require('util');

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

function Correlator () {
  events.EventEmitter.call(this); 
  var self = this;
  this.ready = false;
  this.registry = new QueueRegistry();
  this.registry.getCurrentQueues(function (err, queues) {
    self.ready = true;
    self.emit('ready');
  });
}

util.inherits(Correlator, events.EventEmitter);

Correlator.prototype.getUniqueId = function getUniqueId (queueName, subscriptionId, callback) {
  var id, 
      self = this;
  if ( ! subscriptionId) {
    id = queueName + '.' + newId();
    return callback(null, id);
  }

  function getIdFromQueueData () {
    if( ! self.registry.queues[subscriptionId]) {
      id = queueName + '.' + newId();
      self.registry.queues[subscriptionId] = id;
      self.registry.setCurrentQueues(self.registry.queues, function (err) {
        if (err) callback(err);
        else callback(null, id);
      });
    } else {
      id = self.registry.queues[subscriptionId];
      callback(null, id);
    }
  }

  if (this.ready) {
    getIdFromQueueData();
  } else {
    this.on('ready', function () {
      getIdFromQueueData();
    });
  }
};

function PubSubQueue (connection, queueName, options) {
  this.connection = connection;
  this.correlator = new Correlator();
  this.errorQueueName = queueName + '.error';
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = queueName;
  this.rejected = {}; 
  var self = this;
  connection.exchange('amq.topic', { type: 'topic', durable: true, autoDelete: false }, function (exchange) {
    self.exchange = exchange;
    self.connection.emit('readyToPublish');
  });
};

PubSubQueue.prototype.publish = function publish (event) {
  var self = this;
  if ( ! this.exchange) {
    this.connection.once('readyToPublish', function () {
      self.publish(event);
    });
  } else {
    this.log.debug('publishing to exchange ' + self.exchange.name + ' ' + self.queueName + ' event ' + util.inspect(event));
    process.nextTick(function () {
      self.exchange.publish(self.queueName, event, { contentType: 'application/json', deliveryMode: 2 });
    });
  }
};

PubSubQueue.prototype.subscribe = function subscribe (callback, options) {
  var self = this,
      uniqueName,
      queueOptions = options.queueOptions || {};
  
  this.log.debug('queue options: ', queueOptions);

  if (options && options.ack) {
    self.connection.queue(self.errorQueueName, queueOptions, function(q) {
      q.bind(self.exchange, self.errorQueueName);
      q.on('queueBindOk', function() {
        self.log.debug('bound to ' + self.errorQueueName);  
      });
    });
  }

  this.correlator.getUniqueId(self.queueName, options.subscriptionId, function (err, _id) {
    if (err) throw err;
    uniqueName = _id;
    self.connection.queue(uniqueName, queueOptions, function (q) {
      q.bind(self.exchange, self.queueName);
      q.on('queueBindOk', function() {
        self.log.debug('subscribing to pubsub queue ' + uniqueName + 'on exchange' + self.exchange.name);
        q.subscribe(options, function(message, headers, deliveryInfo, m){
          if (options && options.ack) {
            var handler = {
              ack: function () { m.acknowledge(); },
              acknowledge: function () { m.acknowledge(); },
              reject: function () {
                var msgRejected = self.rejected[message.cid] || 0;
                if (msgRejected >= self.maxRetries) {
                  self.log.error(message);
                  m.acknowledge();
                  delete self.rejected[message.cid];
                } else {
                  msgRejected++;
                  self.rejected[message.cid] = msgRejected;
                  m.reject(true);
                }
              }
            };
            callback(message, handler);
          } else {
            callback(message);
          }
        });
      });
    });
  });
};

module.exports = PubSubQueue;
