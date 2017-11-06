module.exports.deserialize = function deserialize (content) {
  
  try {
    content = JSON.parse(content);
  } catch (err) {
    throw err;
  }

  return content;

};

module.exports.serialize = function serialize (content) { 
  
  try {
    content = JSON.stringify(content);
  } catch (err) {
    throw err;
  }

  return content;

};