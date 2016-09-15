'use strict'

var THIS_ADDON_NAME = 'ember-cli-ecosystem-installer'

module.exports = {
  /**
   * Get a the existing packages in the external application/addon.
   * @param {object} options all the options
   * @returns {object} the existing packages
   */
  getExistingPkgs: function (options) {
    var existingPkgs = {}
    var packages = options.project.pkg.devDependencies
    for (var pkgName in packages) {
      if (pkgName !== THIS_ADDON_NAME) {
        existingPkgs[pkgName] = packages[pkgName]
      }
    }
    return existingPkgs
  },

  /**
   * Returns true if this addon is installed in an external application/addon and false otherwise.
   * @param {object} options all the options
   * @returns {boolean} true if this addon is installed in an external application/addon and false otherwise.
   */
  isThisAddonInstalled: function (options) {
    return this.getExistingPkgs(options)[THIS_ADDON_NAME] !== undefined
  }
}
