module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat',     // nueva funcionalidad
      'fix',      // corrección de error
      'docs',     // solo documentación
      'style',    // formato, espacios, sin cambio lógico
      'refactor', // refactorización sin cambio de comportamiento
      'test',     // añadir o corregir tests
      'chore',    // mantenimiento, dependencias, configuración
      'perf',     // mejora de rendimiento
      'ci',       // configuración CI/CD
      'revert',   // revertir commit anterior
    ]],
    'subject-max-length': [2, 'always', 100],
    'header-max-length': [2, 'always', 120],
  },
};
