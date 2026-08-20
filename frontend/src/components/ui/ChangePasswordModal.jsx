import PropTypes from 'prop-types';
import { useState, useRef } from 'react';
import { api } from '../../services/api';
import { useFocusTrap } from '../../hooks/useFocusTrap';

ChangePasswordModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { onEscape: onClose });

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) {
      setError('La nueva contraseña y su confirmación no coinciden');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSaving(true);
    try {
      // El backend renueva el access/refresh token en cookies httpOnly como efecto
      // secundario (cambiar la contraseña invalida los tokens anteriores) — no hay
      // nada que actualizar en el store de este lado.
      await api.patch('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setSuccess('Contraseña actualizada correctamente.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pwd-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="change-pwd-title" className="font-semibold text-gray-800">Cambiar contraseña</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Contraseña actual</label>
            <input
              type="password"
              className="input"
              value={form.currentPassword}
              onChange={e => setField('currentPassword', e.target.value)}
              required
              disabled={saving || !!success}
            />
          </div>
          <div>
            <label className="label">Nueva contraseña</label>
            <input
              type="password"
              className="input"
              value={form.newPassword}
              onChange={e => setField('newPassword', e.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              disabled={saving || !!success}
            />
          </div>
          <div>
            <label className="label">Confirmar nueva contraseña</label>
            <input
              type="password"
              className="input"
              value={form.confirm}
              onChange={e => setField('confirm', e.target.value)}
              required
              disabled={saving || !!success}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
          )}

          <div className="flex gap-2 pt-2">
            {!success && (
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              {success ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
