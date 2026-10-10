import User from '../models/User.js';
import { regenerateSession, destroySession } from '../middleware/session.js';
import { UnauthorizedError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export const register = async (req, res) => {
  // Dynamic imports to avoid circular dependencies
  const { default: knex } = await import('../database/connection.js');
  const { default: SystemSetting } = await import('../models/SystemSetting.js');
  const { default: Group } = await import('../models/Group.js');

  // Check if this is the first user (bootstrap mode)
  const userCount = await knex('users')
    .where('is_workspace_identity', false)
    .count('* as count')
    .first();
  const isFirstUser = Number(userCount?.count || 0) === 0;

  if (!isFirstUser) {
    // Check if public registration is enabled
    const allowRegistration = await SystemSetting.get('allow_public_registration');
    if (allowRegistration !== 'true') {
      throw new ForbiddenError('Public registration is disabled', 'REGISTRATION_DISABLED');
    }
  }

  const user = await User.create(req.body);

  if (isFirstUser) {
    // First user becomes super_admin
    await knex('users').where('id', user.id).update({ role: 'super_admin' });
    user.role = 'super_admin';

    logger.info('First user registered as super_admin', { userId: user.id });
  } else {
    // Assign to default registration group
    const defaultGroupId = await SystemSetting.get('default_registration_group_id');
    if (defaultGroupId) {
      try {
        await Group.addMember(defaultGroupId, user.id, 'member');
      } catch (err) {
        logger.warn('Failed to add user to default group', {
          userId: user.id, groupId: defaultGroupId, error: err.message,
        });
      }
    }
  }

  // Create session
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.role = user.role;
  req.session.locale = user.locale;
  req.session.currency = user.currency;

  // Persist session to store before responding
  await new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

  logger.info('User registered', { userId: user.id, email: user.email });

  res.status(201).json({
    success: true,
    data: { user },
  });
};

export const login = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Check if user account is active
  if (!user.isActive) {
    logger.warn('Login attempt on suspended account', { email });
    throw new ForbiddenError('This account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  const isValid = await User.verifyPassword(password, user.passwordHash);
  if (!isValid) {
    logger.warn('Failed login attempt', { email });
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  // Regenerate session to prevent fixation
  await regenerateSession(req);

  // Configure session
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.role = user.role;
  req.session.locale = user.locale;
  req.session.currency = user.currency;

  if (rememberMe) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  // Update last login
  await User.updateLastLogin(user.id);

  logger.info('User logged in', { userId: user.id });

  // Remove password hash from response
  const { passwordHash, ...userWithoutPassword } = user;

  res.json({
    success: true,
    data: { user: userWithoutPassword },
  });
};

export const logout = async (req, res) => {
  const userId = req.session.userId;

  await destroySession(req);
  res.clearCookie(req.session?.name || 'budgetos.sid');

  logger.info('User logged out', { userId });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new UnauthorizedError('User not found', 'USER_NOT_FOUND');
  }

  const settings = await User.getSettings(req.user.id);

  // Fetch user groups
  const { default: Group } = await import('../models/Group.js');
  const groups = await Group.findByUser(req.user.id);

  res.json({
    success: true,
    data: { user, settings, groups },
  });
};

export const updateProfile = async (req, res) => {
  const user = await User.update(req.user.id, req.body);

  // Update session if necessary
  if (req.body.locale) req.session.locale = req.body.locale;
  if (req.body.currency) req.session.currency = req.body.currency;

  res.json({
    success: true,
    data: { user },
  });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findByEmail(req.user.email);
  const isValid = await User.verifyPassword(currentPassword, user.passwordHash);

  if (!isValid) {
    throw new BadRequestError('Invalid current password', 'INVALID_CREDENTIALS');
  }

  await User.changePassword(req.user.id, newPassword);

  logger.info('Password changed', { userId: req.user.id });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
};

export const updateSettings = async (req, res) => {
  const settings = await User.updateSettings(req.user.id, req.body);

  res.json({
    success: true,
    data: { settings },
  });
};

export const getSettings = async (req, res) => {
  const settings = await User.getSettings(req.user.id);

  res.json({
    success: true,
    data: { settings },
  });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  // Always return the same response to prevent email enumeration
  const genericResponse = {
    success: true,
    message: 'If an account with this email exists, a reset link has been sent',
  };

  try {
    const user = await User.findByEmail(email);
    if (!user || !user.isActive) {
      // User not found or inactive — return generic response
      return res.json(genericResponse);
    }

    const { default: PasswordResetToken } = await import('../models/PasswordResetToken.js');
    const { default: emailService } = await import('../services/emailService.js');

    const { token, hash } = PasswordResetToken.generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await PasswordResetToken.create(user.id, hash, expiresAt);
    await emailService.sendPasswordResetEmail(user, token, user.locale);

    logger.info('Password reset requested', { userId: user.id });
  } catch (error) {
    // Log but do not expose the error to the user
    logger.error('Error in forgotPassword', { email, error: error.message });
  }

  res.json(genericResponse);
};

export const validateResetToken = async (req, res) => {
  const { token } = req.query;
  const { default: PasswordResetToken } = await import('../models/PasswordResetToken.js');

  const hash = PasswordResetToken.hashToken(token);
  const record = await PasswordResetToken.findByTokenHash(hash);

  if (!record) {
    throw new BadRequestError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
  }

  res.json({ success: true, data: { valid: true } });
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  const { default: PasswordResetToken } = await import('../models/PasswordResetToken.js');

  const hash = PasswordResetToken.hashToken(token);
  const record = await PasswordResetToken.findByTokenHash(hash);

  if (!record) {
    throw new BadRequestError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
  }

  await User.changePassword(record.userId, password);
  await PasswordResetToken.markUsed(record.id);

  logger.info('Password reset completed', { userId: record.userId });

  res.json({
    success: true,
    message: 'Password has been reset successfully',
  });
};

export const getSetupStatus = async (req, res) => {
  const { default: knex } = await import('../database/connection.js');
  const userCount = await knex('users').count('* as count').first();
  const needsSetup = Number(userCount?.count || 0) === 0;
  res.json({ success: true, data: { needsSetup } });
};
