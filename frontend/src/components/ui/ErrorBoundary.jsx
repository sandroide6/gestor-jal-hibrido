import PropTypes from 'prop-types';
import { Component } from 'react';
import Icon from './Icon';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[JAL] Error no capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-bg p-6">
          <div className="max-w-sm text-center" role="alert">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-danger-bg text-danger-fg">
              <Icon name="alerta" size={28} />
            </span>
            <h1 className="title-section mb-2">Algo salió mal</h1>
            <p className="mb-6 text-ink-muted">
              La página tuvo un error inesperado. Recárgala; lo que ya estaba guardado no se pierde.
            </p>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              Recargar la página
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
