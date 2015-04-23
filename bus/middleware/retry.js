var extend = require('extend');
var log = require('debug')('servicebus:retry');
var util = require('util');

var maxRetries = 3;
var localRejected = {};

var methodMax = {};

function createOnly (method, max) {
  var calledByMethod = {};
  methodMax[method] = max;
  return function only (message) {
    if (calledByMethod[method] === undefined) {
      calledByMethod[method] = 1;
    } else {
      calledByMethod[method]++; 
    }
    if (Object.keys(calledByMethod).length && calledByMethod[method] > methodMax[method]) {
      var methods = Object.keys(calledByMethod).join(',');
      throw new Error(util.format('message type: %s cid: %s handle already called with %s', message.content.type, message.content.cid, methods));
    } 
  };
}

function retryLocal (channel, message, options, next) {

  var onlyAckOnce = createOnly('ack', 1);
  var onlyRejectMax = createOnly('reject', maxRetries);

  if (options && options.ack) {

    if ( ! message.properties.headers) message.properties.headers = {};

    message.properties.headers.rejected = localRejected[message.content.cid];

    message.content.handle = {
      ack: function () { 
        onlyAckOnce(message);
        channel.ack(message);  
      },
      acknowledge: function () {
        onlyAckOnce(message);
        channel.ack(message);  
      },
      reject: function () {
        onlyRejectMax(message);
        if (localRejected[message.content.cid] === undefined) {
          localRejected[message.content.cid] = 1;
        } else {
          localRejected[message.content.cid] = localRejected[message.content.cid] + 1;
        }
        if (localRejected[message.content.cid] > maxRetries) {
          var errorQueueName = util.format('%s.error', message.fields.routingKey);
          log('sending message %s to error queue %s', message.content.cid, errorQueueName);
          channel.sendToQueue(errorQueueName, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: localRejected[message.content.cid] } }));
          channel.reject(message, false); 
          delete localRejected[message.content.cid];
        } else {
          log('retrying message %s', message.content.cid);
          channel.reject(message, true); 
        }

      }
    };
  }

  next(null, channel, message, options);
}

function retryDistributed (channel, message, options, next) {    

  if (message.properties.headers.rejected === undefined) {
    message.properties.headers.rejected = 0;
  }

  var onlyAckOnce = createOnly('ack', 1);
  var onlyRejectMax = createOnly('reject', maxRetries);

  if (options && options.ack) {

    message.content.handle = {
      ack: function () { 
        onlyAckOnce(message);
        channel.ack(message); 
      },
      acknowledge: function () { 
        onlyAckOnce(message);
        channel.ack(message); 
      },
      reject: function () {
        onlyRejectMax(message);

        var rejected = message.properties.headers.rejected + 1;

        if (rejected > maxRetries) {

          var errorQueueName = util.format('%s.error', message.fields.routingKey);

          log('sending message %s to error queue %s', message.content.cid, errorQueueName);

          channel.sendToQueue(errorQueueName, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: rejected } }));
          channel.reject(message, false); 

        } else {

          log('retrying message %s', message.content.cid);

          message.properties.headers.rejected = rejected;

          channel.reject(message, false);

          if (options.queueType === 'queue') {
            channel.sendToQueue(message.fields.routingKey, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: rejected } }));
          } else {
            channel.publish(message.fields.exchange, message.fields.routingKey, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: rejected } }));
          }
          
        }

      }
    };

  }

  next(null, channel, message, options);
}

module.exports = function (options) {

  options = options || { localOnly: false };

  if (options.maxRetries) maxRetries = options.maxRetries;

  return {
    handleIncoming: options.localOnly ? retryLocal : retryDistributed
  };

};
