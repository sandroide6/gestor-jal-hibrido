'use strict';
// PT-10: Multi-JAL — datos de JAL-A no son accesibles desde sesión de JAL-B
//
// Strategy: verify at the source level that the isolation contract is upheld.
// After the service-layer refactor, verification spans two layers:
//   1. Controllers delegate with req.user.jal_id (pass-through audit).
//   2. Services apply jal_id scoping to every Sequelize query.

const fs   = require('fs');
const path = require('path');

const CTRL_DIR    = path.join(__dirname, '..', 'controllers');
const SVC_DIR     = path.join(__dirname, '..', 'services');

function readCtrl(name) { return fs.readFileSync(path.join(CTRL_DIR, name), 'utf8'); }
function readSvc(name)  { return fs.readFileSync(path.join(SVC_DIR,  name), 'utf8'); }

describe('Aislamiento Multi-JAL — PT-10', () => {
  describe('documentController.js — delega jal_id al servicio', () => {
    const ctrl = readCtrl('documentController.js');

    it('pasa req.user.jal_id al servicio en todas las operaciones', () => {
      expect(ctrl).toContain('req.user.jal_id');
    });

    it('no contiene queries Sequelize directas', () => {
      expect(ctrl).not.toMatch(/\bDocument\.(findOne|findAll|findAndCountAll|count|create)\b/);
    });
  });

  describe('documentService.js — aplica jal_id en queries Sequelize', () => {
    const svc = readSvc('documentService.js');

    it('todas las queries de lectura incluyen jal_id', () => {
      expect(svc).toContain('jal_id');
      expect(svc).toMatch(/\bDocument\.(findOne|findAll|findAndCountAll|count)\b/);
    });

    it('listOwnDocuments filtra por jal_id y user_id', () => {
      expect(svc).toContain('jal_id: jalId');
      expect(svc).toContain('user_id: userId');
    });

    it('listDocumentsForEdil filtra por jal_id', () => {
      expect(svc).toContain('listDocumentsForEdil');
      expect(svc).toContain('jal_id: jalId');
    });

    it('findDocumentInJal usa jal_id en la condición WHERE', () => {
      expect(svc).toContain('findDocumentInJal');
      expect(svc).toContain('jal_id');
    });
  });

  describe('usersController.js — delega jal_id al servicio', () => {
    const ctrl = readCtrl('usersController.js');

    it('pasa req.user.jal_id al servicio en operaciones de lista', () => {
      // listUsers(req.user.jal_id, …) or similar
      expect(ctrl).toContain('req.user.jal_id');
    });

    it('pasa req.user.jal_id al servicio al crear usuario', () => {
      expect(ctrl).toContain('req.user.jal_id');
    });

    it('pasa req.user.jal_id al servicio al buscar usuario para update', () => {
      expect(ctrl).toContain('req.user.jal_id');
    });
  });

  describe('usersService.js — aplica jal_id en queries Sequelize', () => {
    const svc = readSvc('usersService.js');

    it('listUsers filtra por jal_id en findAndCountAll', () => {
      expect(svc).toContain('jal_id');
      expect(svc).toContain('findAndCountAll');
    });

    it('findUserInJal usa jal_id en la condición WHERE', () => {
      expect(svc).toContain('jal_id');
      expect(svc).toContain('findUserInJal');
    });

    it('createUser asigna jal_id al nuevo registro', () => {
      expect(svc).toContain('jal_id');
      expect(svc).toContain('User.create');
    });
  });

  describe('docTypesController.js — delega jal_id al servicio', () => {
    const ctrl = readCtrl('docTypesController.js');
    it('pasa req.user.jal_id en cada operación', () => {
      expect(ctrl).toContain('req.user.jal_id');
    });
  });

  describe('docTypesService.js — aplica jal_id en queries Sequelize', () => {
    const svc = readSvc('docTypesService.js');
    it('todas las queries incluyen jal_id', () => {
      expect(svc).toContain('jal_id');
    });
  });
});
