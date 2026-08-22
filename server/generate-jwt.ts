import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

const payload = {
  userId: 1, // System admin
  roles: ['SYSTEM_ADMIN'],
  // No expiration!
};

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("Missing JWT_SECRET");

const token = jwt.sign(payload, secret);
console.log(token);
