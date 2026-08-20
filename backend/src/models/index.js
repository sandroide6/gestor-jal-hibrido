'use strict';
const { Sequelize } = require('sequelize');
const config = require('../../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = dbConfig.url
  ? new Sequelize(dbConfig.url, dbConfig)
  : new Sequelize(dbConfig);

// ── Carga de modelos ──────────────────────────────────────
const Jal = require('./Jal')(sequelize);
const User = require('./User')(sequelize);
const DocType = require('./DocType')(sequelize);
const Document = require('./Document')(sequelize);
const SyncQueue = require('./SyncQueue')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);
const Notification = require('./Notification')(sequelize);
const BackupLog    = require('./BackupLog')(sequelize);

// ── Asociaciones ──────────────────────────────────────────

// JAL → Usuarios
Jal.hasMany(User, { foreignKey: 'jal_id', as: 'users' });
User.belongsTo(Jal, { foreignKey: 'jal_id', as: 'jal' });

// JAL → Tipos de documento
Jal.hasMany(DocType, { foreignKey: 'jal_id', as: 'docTypes' });
DocType.belongsTo(Jal, { foreignKey: 'jal_id', as: 'jal' });

// Usuario → Registros de auditoría
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Usuario → Notificaciones
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// JAL → Documentos
Jal.hasMany(Document, { foreignKey: 'jal_id', as: 'documents' });
Document.belongsTo(Jal, { foreignKey: 'jal_id', as: 'jal' });

// Usuario → Documentos (auxiliar que generó el doc)
User.hasMany(Document, { foreignKey: 'user_id', as: 'documents' });
Document.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// Edil que revisó el documento
Document.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// Edil a cuyo nombre se generó el documento
Document.belongsTo(User, { foreignKey: 'edil_id', as: 'edil' });

// Tipo de documento → Documentos (snapshot: doc_type_id puede ser null)
DocType.hasMany(Document, { foreignKey: 'doc_type_id', as: 'documents' });
Document.belongsTo(DocType, { foreignKey: 'doc_type_id', as: 'docType' });

// Usuario → Cola de sincronización
User.hasMany(SyncQueue, { foreignKey: 'user_id', as: 'syncQueue' });
SyncQueue.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// JAL → Cola de sincronización
Jal.hasMany(SyncQueue, { foreignKey: 'jal_id', as: 'syncQueue' });
SyncQueue.belongsTo(Jal, { foreignKey: 'jal_id', as: 'jal' });

module.exports = {
  sequelize,
  Sequelize,
  Jal,
  User,
  DocType,
  Document,
  SyncQueue,
  AuditLog,
  Notification,
  BackupLog,
};
