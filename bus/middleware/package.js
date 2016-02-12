function packageMessage (queueName, message, options, next) {
  if (typeof options === 'function') {
    next = options;
    options = null;
  }

  var newMessage = {
      data: message
    , datetime: message.datetime || new Date().toUTCString()
    , type: message.type || queueName
  };

  next(null, queueName, newMessage, options);

}

function handleIncoming (channel, message, options, next) {
  message.content.type = message.properties.type || message.content.type;
  next(null, channel, message, options);
}

module.exports = function () {
  return {
    handleOutgoing: packageMessage,
    handleIncoming: handleIncoming
  };
};