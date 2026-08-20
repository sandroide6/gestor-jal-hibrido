'use strict';
const { Notification } = require('../models');
const { Op } = require('sequelize');

async function list(req, res, next) {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.sub },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    const unread = notifications.filter(n => !n.read).length;
    res.json({ notifications, unread });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    const n = await Notification.findOne({
      where: { id: req.params.id, user_id: req.user.sub },
    });
    if (!n) return res.status(404).json({ error: true, message: 'Notificación no encontrada' });
    await n.update({ read: true });
    res.json({ id: n.id, read: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.update(
      { read: true },
      { where: { user_id: req.user.sub, read: false } }
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const deleted = await Notification.destroy({
      where: { id: req.params.id, user_id: req.user.sub },
    });
    if (!deleted) return res.status(404).json({ error: true, message: 'Notificación no encontrada' });
    res.json({ message: 'Notificación eliminada' });
  } catch (err) { next(err); }
}

async function unreadCount(req, res, next) {
  try {
    const count = await Notification.count({
      where: { user_id: req.user.sub, read: false },
    });
    res.json({ count });
  } catch (err) { next(err); }
}

module.exports = { list, markRead, markAllRead, remove, unreadCount };
