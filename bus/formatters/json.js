module.exports.deserialize = function deserialize (content, cb) {

  if (content === undefined || content === null) return cb(null, content);
  
  try {
    content = JSON.parse(content);
  } catch (err) {
    return cb(err);
  }

  return cb(null, content);

};

module.exports.serialize = function serialize (content, cb) { 

  if (content === undefined || content === null) return cb(null, content);
  
  try {
    content = JSON.stringify(content);
  } catch (err) {
   return cb(err);
  }

  return cb(null, content);

};