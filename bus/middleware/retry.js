var log = require('debug')('servicebus:retry');
var util = require('util');

var maxRetries = 5;

module.exports = function (options) {
  options = options || {};

  if (options.maxRetries) maxRetries = options.maxRetries;

  return {

    handleIncoming: function retry (channel, message, options, next) {

      if (options && options.ack) {

        message.content.handle = {
          ack: function () { 
            channel.ack(message); 
          },
          acknowledge: function () { 
            channel.ack(message); 
          },
          reject: function () {

            var rejected = message.content.handle.rejected + 1;

            if (rejected > maxRetries) {

              var errorQueueName = util.format('%s.error', message.fields.routingKey);

              log('sending message %s to error queue %s', message.content.cid, errorQueueName);

              channel.sendToQueue(errorQueueName, new Buffer(JSON.stringify(message.content)), options);
              channel.nack(message, false, false); 

            } else {

              log('retrying message %s', message.content.cid);

              message.content.handle.rejected = rejected;

              channel.nack(message, false, false);

              if (options.queueType === 'queue') {
                channel.sendToQueue(message.fields.routingKey, new Buffer(JSON.stringify(message.content)), options);
              } else {
                channel.publish(message.fields.exchange, message.fields.routingKey, new Buffer(JSON.stringify(message.content)), options);
              }
              
            }

          },
          rejected: (message.content.handle) ? message.content.handle.rejected : 0
        };

      }

      next(null, channel, message, options);
    }

  };
} 