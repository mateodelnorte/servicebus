var events = require('events'),
    util = require('util');

function Queue(connection, queueName, options) {
  this.connection = connection;
  this.errorQueueName = queueName + '.error';
  this.initialized = false;
  this.log = options.log;
  this.maxRetries = options.maxRetries || 3;
  this.queueName = queueName;
  this.rejected = {};

  events.EventEmitter.call(this);
}

util.inherits(Queue, events.EventEmitter);

Queue.prototype.error = function error (event) {
  this.log.error('Message moved to error queue: ' + this.errorQueueName);
  this.connection.publish(this.errorQueueName, event, { contentType: 'application/json', deliveryMode: 2 });
};

Queue.prototype.listen = function listen (callback, options) {
  var options = options || {},
      queueOptions = options.queueOptions || {};
  
  var self = this;

  if (options && options.ack) {
    self.connection.queue(self.queueName + '.error', queueOptions, function(eq) {
      eq.bind(self.errorQueueName);
      eq.on('queueBindOk', function() {
        self.log.info('bound to ' + self.errorQueueName);  
      });
    });
  }
  
  var q = this.connection.queue(this.queueName, queueOptions, function() {
    q.bind(self.queueName);
    q.on('queueBindOk', function() {
      self.log.debug('listening to queue', self.queueName);
      q.subscribe(options, function(message, headers, deliveryInfo, m){
        if (options && options.ack) {
          var handler = {
            ack: function () { m.acknowledge(); },
            acknowledge: function () { m.acknowledge(); },
            reject: function () {
              var msgRejected = self.rejected[message.cid] || 0;
              if (msgRejected >= self.maxRetries) {
                self.error(message);
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
      self.initialized = true;
    });
  });
};

Queue.prototype.send = function send (event) {
  var self = this;
  this.log.debug('sending to queue ' + this.queueName + ' event ' + util.inspect(event));
  process.nextTick(function () {
    self.connection.publish(self.queueName, event, { contentType: 'application/json', deliveryMode: 2 });
  });
};

module.exports = Queue;