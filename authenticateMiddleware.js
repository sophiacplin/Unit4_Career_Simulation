const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'secret123';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  console.log('Authorization Header:', authHeader);

  if(!token){
    return res.status(401).send({message:'You need to log in to gain access.'});
  }
  jwt.verify(token, jwtSecret, (err, user) => {
    if(err){
      return res.status(403).send({message:'Invalid or expired token'});
    }
    console.log('Decoded JWT user:', req.user);
    console.log("User from JWT:", user);
    req.user = user;
    next();
  });
};

const authorizeRoles = (roles) => {
  return(req, res, next) => {
    const userRole = req.user.role;

    if(!roles.includes(userRole)){
      return res.status(403).send({message: 'You are not authorized to perform this action'});
    }

    next();
  };
};


module.exports = {authenticateToken, authorizeRoles};