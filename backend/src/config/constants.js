'use strict';

const ROLES = ['administrador', 'edil', 'auxiliar'];
const SYNC_STATUSES = ['pending', 'synced', 'conflict'];
const FIELD_TYPES = ['text', 'textarea', 'date', 'time', 'number', 'select', 'checkbox', 'checklist', 'duracion', 'periodo'];
const TIPOS_TRAMITE = ['entrada', 'salida', 'interno'];
const TIPO_TRAMITE_ABBR = { entrada: 'ENT', salida: 'SAL', interno: 'INT' };

module.exports = { ROLES, SYNC_STATUSES, FIELD_TYPES, TIPOS_TRAMITE, TIPO_TRAMITE_ABBR };
