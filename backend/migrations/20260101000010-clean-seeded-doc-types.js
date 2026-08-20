'use strict';

const JAL_ID = '00000000-0000-0000-0000-000000000001';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM doc_types WHERE jal_id = '${JAL_ID}'`
    );
  },
  async down() {},
};
