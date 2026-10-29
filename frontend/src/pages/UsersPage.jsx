import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuthStore } from '../stores/authStore';
import AppLayout from '../components/ui/AppLayout';
import { createUser, updateUser, deleteUser, hardDeleteUser } from '../services/usersService';
import { useUsers } from '../hooks/useUsers';
import { ROLES, ROLE_LABEL } from '../constants';
import { toast } from '../stores/toastStore';
import { SkeletonTable } from '../components/ui/Skeleton';
import Dialog, { ConfirmDialog } from '../components/ui/Dialog';
import Notice from '../components/ui/Notice';
import Spinner from '../components/ui/Spinner';
import StatusBadge from '../components/ui/StatusBadge';
import Icon from '../components/ui/Icon';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'auxiliar' };

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const [form, setForm] = useState(
    isEdit ? { name: user.name, email: user.email, role: user.role } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    <Dialog title={isEdit ? `Editar a ${user.name}` : 'Nuevo usuario'} onClose={saving ? () => {} : onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="u-nombre">Nombre completo</label>
          <input id="u-nombre" className="input" value={form.name} autoComplete="off"
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required minLength={2} disabled={saving} />
        </div>
        <div>
          <label className="label" htmlFor="u-correo">Correo electrónico</label>
          <p className="hint" id="u-correo-hint">Con este correo inicia sesión.</p>
          <input id="u-correo" className="input" type="email" value={form.email} autoComplete="off" aria-describedby="u-correo-hint"
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required disabled={saving} />
        </div>
        {!isEdit && (
          <div>
            <label className="label" htmlFor="u-clave">Contraseña temporal</label>
            <p className="hint" id="u-clave-hint">Mínimo 8 caracteres. Entrégala a la persona para que la cambie al entrar.</p>
            <input id="u-clave" className="input" type="password" value={form.password} autoComplete="new-password" aria-describedby="u-clave-hint"
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required minLength={8} disabled={saving} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="u-rol">Rol</label>
          <select id="u-rol" className="input" value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            disabled={saving}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        <div className="flex flex-wrap-reverse justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving || undefined}>
            {saving && <Spinner />}
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
const userShape = PropTypes.shape({ id: PropTypes.string, name: PropTypes.string, email: PropTypes.string, role: PropTypes.string });
UserModal.propTypes = {
  user: userShape,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
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
      title: `¿Desactivar a ${user.name}?`,
      message: 'No podrá iniciar sesión y sus sesiones abiertas se cerrarán. Sus documentos se conservan y puedes volver a activarla cuando quieras.',
      confirmLabel: 'Desactivar',
      action: async () => {
        setConfirm((c) => c && { ...c, busy: true });
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
      toast.success('Usuario activado.');
    } catch (err) {
      toast.error(err.message || 'Error al reactivar el usuario');
    }
  }

  function askHardDelete(user) {
    setConfirm({
      title: `¿Eliminar a ${user.name} para siempre?`,
      message: 'La cuenta se borra del sistema y no se puede deshacer. Solo es posible si no tiene documentos registrados; si los tiene, desactívala.',
      confirmLabel: 'Eliminar para siempre',
      action: async () => {
        setConfirm((c) => c && { ...c, busy: true });
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

  const actions = (u) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary btn-sm" onClick={() => setModal({ type: 'edit', user: u })}
        aria-label={`Editar a ${u.name}`}>
        Editar
      </button>
      {u.id !== me?.id && u.active && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => askDeactivate(u)} aria-label={`Desactivar a ${u.name}`}>Desactivar</button>
      )}
      {u.id !== me?.id && !u.active && (
        <button type="button" className="btn-ghost btn-sm" onClick={() => handleReactivate(u.id)} aria-label={`Activar a ${u.name}`}>Activar</button>
      )}
      {u.id !== me?.id && (
        <button type="button" className="btn-ghost btn-sm !text-danger-fg hover:!bg-danger-bg" onClick={() => askHardDelete(u)} aria-label={`Eliminar a ${u.name}`}>Eliminar</button>
      )}
    </div>
  );

  return (
    <AppLayout
      title="Usuarios"
      eyebrow="Administración"
      description={loading ? 'Cargando…' : `${displayUsers.length} cuenta${displayUsers.length === 1 ? '' : 's'}. Desactiva a quien ya no trabaja con la JAL: sus documentos se conservan.`}
      actions={<button type="button" className="btn-primary" onClick={() => setModal({ type: 'create' })}><Icon name="mas" />Nuevo usuario</button>}
      width="page"
    >
      {modal?.type === 'create' && (
        <UserModal onClose={() => setModal(null)} onSave={handleCreate} />
      )}
      {modal?.type === 'edit' && (
        <UserModal user={modal.user} onClose={() => setModal(null)}
          onSave={form => handleEdit(modal.user.id, form)} />
      )}
      {confirm && (
        <ConfirmDialog danger title={confirm.title} message={confirm.message} confirmLabel={confirm.confirmLabel}
          busy={!!confirm.busy} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />
      )}

      {error && (
        <Notice tone="danger" title="No se pudo cargar la lista de usuarios" className="mb-4"
          action={reload && <button type="button" className="btn-secondary btn-sm" onClick={reload}>Intentar de nuevo</button>}>
          {error}
        </Notice>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : (
        <>
          {/* Escritorio: tabla */}
          <div className="table-wrap relative hidden overflow-x-auto lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.map(u => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}{u.id === me?.id && <span className="ml-1 font-normal text-ink-muted">(tú)</span>}</td>
                    <td className="text-ink-muted">{u.email}</td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td>{u.active ? <StatusBadge tone="success">Activo</StatusBadge> : <StatusBadge tone="neutral">Inactivo</StatusBadge>}</td>
                    <td className="text-right">{actions(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil y tableta: fichas */}
          <ul className="space-y-3 lg:hidden">
            {displayUsers.map(u => (
              <li key={u.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{u.name}{u.id === me?.id && <span className="ml-1 font-normal text-ink-muted">(tú)</span>}</p>
                    <p className="break-all text-ink-muted">{u.email}</p>
                    <p className="mt-1">{ROLE_LABEL[u.role]}</p>
                  </div>
                  {u.active ? <StatusBadge tone="success">Activo</StatusBadge> : <StatusBadge tone="neutral">Inactivo</StatusBadge>}
                </div>
                <div className="mt-3 border-t border-line pt-3">{actions(u)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppLayout>
  );
}
