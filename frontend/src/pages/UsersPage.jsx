import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { createUser, updateUser, deleteUser, hardDeleteUser } from '../services/usersService';
import { useUsers } from '../hooks/useUsers';
import { ROLES, ROLE_LABEL } from '../constants';
import { toast } from '../stores/toastStore';
import { SkeletonTable } from '../components/ui/Skeleton';
const EMPTY_FORM = { name: '', email: '', password: '', role: 'auxiliar' };

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const [form, setForm] = useState(
    isEdit ? { name: user.name, email: user.email, role: user.role } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { onEscape: onClose });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar');
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
        aria-labelledby="user-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="user-modal-title" className="font-semibold text-gray-800">
            {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required minLength={2} disabled={saving} />
          </div>
          <div>
            <label className="label">Correo electrónico</label>
            <input className="input" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required disabled={saving} />
          </div>
          {!isEdit && (
            <div>
              <label className="label">Contraseña temporal</label>
              <input className="input" type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required minLength={8} disabled={saving}
                placeholder="Mínimo 8 caracteres" />
            </div>
          )}
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              disabled={saving}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
const userShape = PropTypes.shape({ id: PropTypes.string, name: PropTypes.string, email: PropTypes.string, role: PropTypes.string });
UserModal.propTypes = {
  user: userShape,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

function ConfirmModal({ message, onConfirm, onCancel }) {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { onEscape: onCancel });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-modal-desc"
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
      >
        <p id="confirm-modal-desc" className="text-gray-700 text-sm mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}
ConfirmModal.propTypes = {
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default function UsersPage() {
  const { token, user: me } = useAuthStore();
  const { data, loading, error, reload } = useUsers(token);
  const [users, setUsers] = useState(null); // null = usar data del hook
  const [modal, setModal] = useState(null); // null | { type: 'create'|'edit', user? }
  const [confirm, setConfirm] = useState(null); // null | { message, action }

  // Usamos data del hook hasta que haya una modificación local
  const displayUsers = users ?? data ?? [];

  async function handleCreate(form) {
    const created = await createUser(form, token);
    setUsers((prev) => [...(prev ?? data ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleEdit(userId, form) {
    const updated = await updateUser(userId, form, token);
    setUsers((prev) => (prev ?? data ?? []).map((u) => u.id === userId ? { ...u, ...updated } : u));
  }

  function askDeactivate(user) {
    setConfirm({
      message: `¿Desactivar a ${user.name}? Sus sesiones activas se cerrarán inmediatamente.`,
      action: async () => {
        try {
          await deleteUser(user.id, token);
          setUsers((prev) => (prev ?? data ?? []).map((u) => u.id === user.id ? { ...u, active: false } : u));
          toast.success(`Usuario ${user.name} desactivado.`);
        } catch (err) {
          toast.error(err.message || 'Error al desactivar el usuario');
        } finally {
          setConfirm(null);
        }
      },
    });
  }

  async function handleReactivate(userId) {
    try {
      const updated = await updateUser(userId, { active: true }, token);
      setUsers((prev) => (prev ?? data ?? []).map((u) => u.id === userId ? { ...u, ...updated } : u));
      toast.success('Usuario reactivado correctamente.');
    } catch (err) {
      toast.error(err.message || 'Error al reactivar el usuario');
    }
  }

  function askHardDelete(user) {
    setConfirm({
      message: `¿Eliminar permanentemente a ${user.name}? Esta acción es irreversible y borrará el usuario del sistema. Solo es posible si no tiene documentos registrados.`,
      action: async () => {
        try {
          await hardDeleteUser(user.id, token);
          setUsers((prev) => (prev ?? data ?? []).filter((u) => u.id !== user.id));
          toast.success(`Usuario ${user.name} eliminado permanentemente.`);
        } catch (err) {
          toast.error(err.message || 'Error al eliminar el usuario');
        } finally {
          setConfirm(null);
        }
      },
    });
  }

  return (
    <AppLayout title="Gestión de Usuarios">
      {modal?.type === 'create' && (
        <UserModal onClose={() => setModal(null)} onSave={handleCreate} />
      )}
      {modal?.type === 'edit' && (
        <UserModal user={modal.user} onClose={() => setModal(null)}
          onSave={form => handleEdit(modal.user.id, form)} />
      )}
      {confirm && (
        <ConfirmModal message={confirm.message}
          onConfirm={confirm.action} onCancel={() => setConfirm(null)} />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{displayUsers.length} usuario(s)</p>
        <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Nuevo usuario
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-jal-blue-500 text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium hidden md:table-cell">Correo</th>
              <th className="px-4 py-3 text-left text-xs font-medium hidden sm:table-cell">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium hidden sm:table-cell">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-4"><SkeletonTable rows={5} cols={5} /></td></tr>
            )}
            {!loading && displayUsers.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-800 text-xs">
                  <div>{u.name}{u.id === me?.id && <span className="ml-1 text-gray-400">(tú)</span>}</div>
                  <div className="sm:hidden text-gray-400 font-normal mt-0.5">
                    <span className="inline-block px-1.5 py-0.5 rounded-full bg-jal-blue-50 text-jal-blue-500 mr-1">{ROLE_LABEL[u.role]}</span>
                    {u.active ? <span className="text-green-600">Activo</span> : <span className="text-red-500">Inactivo</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{u.email}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-jal-blue-100 text-jal-blue-600">
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {u.active
                    ? <span className="badge-synced">Activo</span>
                    : <span className="badge-conflict">Inactivo</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="text-xs text-jal-blue-500 hover:underline"
                      onClick={() => setModal({ type: 'edit', user: u })}>
                      Editar
                    </button>
                    {u.id !== me?.id && u.active && (
                      <button className="text-xs text-red-500 hover:underline" onClick={() => askDeactivate(u)}>Desactivar</button>
                    )}
                    {u.id !== me?.id && !u.active && (
                      <button className="text-xs text-green-600 hover:underline" onClick={() => handleReactivate(u.id)}>Activar</button>
                    )}
                    {u.id !== me?.id && (
                      <button className="text-xs text-red-700 hover:underline font-semibold" onClick={() => askHardDelete(u)}>Eliminar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
