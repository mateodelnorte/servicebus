var newId = require('node-uuid');

function addCorrelationId (queueName, message, options, next) {
  if (typeof options === 'function') {
    next = options;
    options = null;
  }

  if ( ! message.cid) {
    message.cid = newId();
  }

  next(null, queueName, message, options);
}

module.exports = function () {
  return {
    handleOutgoing: addCorrelationId
  };
}