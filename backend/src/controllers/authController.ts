import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { config } from '../config';
import { asyncHandler, createError } from '../middleware/errorHandler';

const signToken = (userId: string, email: string): string =>
  jwt.sign({ userId, email }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw createError('Name, email, and password are required', 400);
  }
  if (password.length < 8) {
    throw createError('Password must be at least 8 characters', 400);
  }

  const existing = await User.findOne({ email });
  if (existing) throw createError('Email already in use', 409);

  const user = await User.create({ name, email, password });
  const token = signToken(user._id.toString(), user.email);

  res.status(201).json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) throw createError('Email and password are required', 400);

  const user = await User.findOne({ email }).select('+password');
  if (!user) throw createError('Invalid credentials', 401);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw createError('Invalid credentials', 401);

  const token = signToken(user._id.toString(), user.email);

  res.json({
    success: true,
    token,
    user: { id: user._id, name: user.name, email: user.email },
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  res.json({
    success: true,
    user: { id: user._id, name: user.name, email: user.email },
  });
});
