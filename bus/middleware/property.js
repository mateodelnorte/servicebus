var warn = require('debug')('servicebus:warn');

function addMessageProperties (channel, message, options, next) {
  if (typeof message.content === 'object') {
    if (!message.content.properties) {
      message.content.properties = message.properties;
    }
  } else {
    warn('Property middleware requires the use of middleware .package.');
  }

  next(null, channel, message, options, next);
}

module.exports = function () {
  return {
    handleIncoming: addMessageProperties
  };
};