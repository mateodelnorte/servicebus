var debug = require('debug'),
    util = require('util');

module.exports = function (label) {
  label = label || 'servicebus';

  var log = debug(label);

  function logIncoming (queueName, message, next) {
    log('received ' + util.inspect(message));
    next(null, queueName, message);
  }

  function logOutgoing (message, headers, deliveryInfo, messageHandle, options, next) {    
    log('sending ' + util.inspect(message));
    next(null, message, headers, deliveryInfo, messageHandle, options);
  }

  return {
    handleIncoming: logIncoming,
    handleOutgoing: logOutgoing
  };
} 