import PropTypes from 'prop-types';
import { useState } from 'react';
import { api } from '../../services/api';
import Dialog from './Dialog';
import Notice from './Notice';
import Spinner from './Spinner';

ChangePasswordModal.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    <Dialog title="Cambiar contraseña" description="Después del cambio, la sesión sigue abierta en este equipo." onClose={saving ? () => {} : onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        <div>
          <label className="label" htmlFor="pwd-actual">Contraseña actual</label>
          <input id="pwd-actual" type="password" autoComplete="current-password" className="input"
            value={form.currentPassword} onChange={e => setField('currentPassword', e.target.value)}
            required disabled={saving || !!success} />
        </div>
        <div>
          <label className="label" htmlFor="pwd-nueva">Nueva contraseña</label>
          <p className="hint" id="pwd-nueva-hint">Mínimo 8 caracteres.</p>
          <input id="pwd-nueva" type="password" autoComplete="new-password" className="input"
            aria-describedby="pwd-nueva-hint"
            value={form.newPassword} onChange={e => setField('newPassword', e.target.value)}
            required minLength={8} disabled={saving || !!success} />
        </div>
        <div>
          <label className="label" htmlFor="pwd-confirmar">Escríbela otra vez</label>
          <input id="pwd-confirmar" type="password" autoComplete="new-password" className="input"
            value={form.confirm} onChange={e => setField('confirm', e.target.value)}
            required disabled={saving || !!success} />
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <div className="flex flex-wrap-reverse justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {success ? 'Cerrar' : 'Cancelar'}
          </button>
          {!success && (
            <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving || undefined}>
              {saving && <Spinner />}
              {saving ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
