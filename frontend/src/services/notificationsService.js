import { api } from './api';

export const fetchNotifications = (token)     => api.get('/notifications', { token });
export const markNotificationRead = (id, token) => api.patch(`/notifications/${id}/read`, {}, { token });
export const markAllNotificationsRead = (token) => api.patch('/notifications/read-all', {}, { token });
export const deleteNotification = (id, token)   => api.delete(`/notifications/${id}`, { token });
