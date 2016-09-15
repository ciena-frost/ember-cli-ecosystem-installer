'use strict'

var _ = require('lodash')

var ADDON_LTS_KEYWORD = 'ember-cli-ecosystem-lts'
var ECOSYSTEM_FILE_NAME = 'lts'
var MANDATORY_KEY = 'mandatory'

module.exports = {
  /**
   * Get the content of the ecosystem LTS file (groups and packages).
   * @param {object} options all the options
   * @returns {object} the content of the ecosystem LTS file (groups and packages)
   */
  _getEcosystemContent: function (options) {
    var filesContent = {}

    var filePath = options.ltsFile
    if (filePath && filePath.trim() !== '') {
      filesContent = require('../../' + filePath)
    } else {
      var addonPackages = options.project.addonPackages

      for (var addonName in addonPackages) {
        var addon = addonPackages[addonName]
        if (addon.pkg.keywords.indexOf(ADDON_LTS_KEYWORD) > -1) {
          var file = require(addon.path + '/' + ECOSYSTEM_FILE_NAME + '.json')
          _.merge(filesContent, file)
        }
      }
    }
    return filesContent
  },

  /**
   * Get the mandatory groups and packages requested.
   * @param {object} options all the options
   * @returns {object} an object containing all the mandatory groups and packages
   */
  getMandatoryGroupsNPkgs: function (options) {
    var ecosystemContent = this._getEcosystemContent(options)
    if (ecosystemContent && ecosystemContent[MANDATORY_KEY]) {
      return ecosystemContent[MANDATORY_KEY]
    }
    return {}
  },

  /**
   * Get the non mandatory groups and packages requested.
   * @param {object} options all the options
   * @returns {object} an object containing all the non mandatory groups and packages
   */
  getOptionalGroupsNPkgs: function (options) {
    var ecosystemContent = this._getEcosystemContent(options)

    var groupsNPkgs = {}
    if (ecosystemContent) {
      for (var key in ecosystemContent) {
        if (key !== MANDATORY_KEY) {
          groupsNPkgs[key] = ecosystemContent[key]
        }
      }
    }

    return groupsNPkgs
  }
}
