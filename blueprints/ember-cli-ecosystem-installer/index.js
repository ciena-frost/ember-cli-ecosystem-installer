'use strict'

var _ = require('lodash')
var figures = require('figures')

var actionHandler = require('../../lib/models/action')
var actionsEnum = actionHandler.actionsEnum
var userInputHandler = require('../../lib/ui/user-input')
var groupHandler = require('../../lib/models/group')
var packageHandler = require('../../lib/models/package')
var externalApplicationUtil = require('../../lib/utils/external-application')
var recommendedGroupsUtil = require('../../lib/utils/recommended-groups')
var objUtil = require('../../lib/utils/obj')
var stateHandler = require('../../lib/models/state')
var statesEnum = stateHandler.statesEnum
var npm = require('../../lib/utils/npm')
var display = require('../../lib/ui/display')

var MESSAGES = {
  QUESTION_RECOMMENDED_GROUPS:
    'Choose the ecosystem features to install [' + figures.radioOn + ' ] or uninstall [' + figures.radioOff + ' ]',
  QUESTION_OTHER_GROUPS:
    'Choose the application specific packages to keep [' + figures.radioOn +
    ' ] or uninstall [' + figures.radioOff + ' ]',
  INSTALLING_LTS: 'Installing ecosystem features',
  LOADING_VALIDATING_LTS_FILES: 'Loading and validating ecosystem files',
  LOADED_VALIDATED_LTS_FILES: 'Loaded and validated ecosystem files\n',
  CONFIRMATION: 'Would you like to confirm the following choices',
  SUMMARY: 'Summary of the operations that will be done',
  UNINSTALLING_PKGS: 'Uninstalling packages',
  CHECKING_PACKAGES: 'Checking packages content',
  CHECKED_PACKAGES: 'Checked packages content',
  INSTALLING_PKGS: 'Installing packages'
}

var QUESTION_RECOMMENDED_GROUPS = {
  name: 'userInputRecommendGroups',
  message: MESSAGES.QUESTION_RECOMMENDED_GROUPS
}

var QUESTION_OTHER_GROUPS = {
  name: 'userInputOtherGroups',
  message: MESSAGES.QUESTION_OTHER_GROUPS
}

var QUESTION_CONFIRM = {
  name: 'confirmSelection',
  message: MESSAGES.CONFIRMATION
}

var MANDATORY_TO_STR = 'mandatory'

module.exports = {
  description: 'Install requested packages',
  availableOptions: [
    {
      name: 'lts-file',
      type: String,
      default: ''
    }
  ],

  normalizeEntityName: function () {
    // this prevents an error when the entityName is
    // not specified (since that doesn't actually matter
    // to us
  },

  /**
   * Query the user to determine which packages/groups he wants to install.
   * Note: Some packages/groups are mandatory and the others are optional
   * @param {object} options all the options
   * @returns {object} a list of the packages to install
   */
  afterInstall: function (options) {
    this.displayWelcomeTag()
    display.title(MESSAGES.INSTALLING_LTS)
    display.title(MESSAGES.LOADING_VALIDATING_LTS_FILES)
    var existingPkgs = externalApplicationUtil.getExistingPkgs(options)
    var recommendedGroups = this.getRecommendedGroups(options, existingPkgs)
    var otherGroups = this.getOtherGroups(existingPkgs, recommendedGroups)
    display.title(MESSAGES.LOADED_VALIDATED_LTS_FILES)

    var recommendGroupsPromise = this.getSelectedRecommendedPkgs(recommendedGroups)

    var self = this
    if (recommendGroupsPromise) {
      return recommendGroupsPromise.then(function (recommendedPackagesToModify) {
        var otherGroupsPromise = self.getSelectedOtherPkgs(otherGroups)
        if (otherGroupsPromise) {
          return otherGroupsPromise.then(function (otherPackagesToModify) {
            var pkgsToModify = _.mergeWith(otherPackagesToModify, recommendedPackagesToModify, objUtil.mergeArray)
            return self.uninstallAndInstallPkgs(pkgsToModify)
          })
        } else {
          return self.uninstallAndInstallPkgs(recommendedPackagesToModify)
        }
      })
    } else {
      var otherGroupsPromise = this.getSelectedOtherPkgs(otherGroups)
      if (otherGroupsPromise) {
        return otherGroupsPromise.then(function (otherPackagesToModify) {
          return self.uninstallAndInstallPkgs(otherPackagesToModify)
        })
      }
    }
  },

  /**
   * Display welcome tag
   */
  displayWelcomeTag: function () {
    console.log('.____  ____________________  ')
    console.log('|    | \\__    ___/   _____/ ')
    console.log('|    |   |    |  \\_____  \\ ')
    console.log('|    |___|    |  /        \\ ')
    console.log('|________\\____| /_________/ ')
    console.log('Tool to install/uninstall the LTS ecosystem packages\n')
  },

  /**
   * Uninstall and install the packages passed in parameter.
   * @param {object} packages the packages to install/uninstall
   * @returns {Promise} a promise to uninstall/install packages
   */
  uninstallAndInstallPkgs: function (packages) {
    display.carriageReturn()
    // Unistall the packages
    var removePackagesPromise = this.unistallPkgs(packages)

    // Install the packages
    if (removePackagesPromise) {
      var self = this
      return removePackagesPromise.then(function () {
        return self.installPkgs(packages)
      })
    } else {
      return this.installPkgs(packages)
    }
  },

  /**
   * Uninstall the packages passed in parameter.
   * @param {object} packages the packages to install/uninstall
   * @returns {Promise} a promise to uninstall packages
   */
  unistallPkgs: function (packages) {
    if (packages && packages[actionsEnum.REMOVE]) {
      display.title(MESSAGES.UNINSTALLING_PKGS)
      var packagesToUninstall = packages[actionsEnum.REMOVE]
      return this.removePackagesFromProject(packagesToUninstall)
    }
  },

  /**
   * Install the packages passed in parameter.
   * @param {object} packages the packages to install/uninstall
   * @returns {Promise} a promise to install packages
   */
  installPkgs: function (packages) {
    if (packages) {
      display.title(MESSAGES.INSTALLING_PKGS)
      var packagesToInstall = packages[actionsEnum.OVERWRITE]
      var packagesToInstallByName = this.getPackagesByName(packagesToInstall)

      if (packagesToInstall && !_.isEmpty(packagesToInstall)) {
        var spinner = display.getSpinner(MESSAGES.CHECKING_PACKAGES)
        spinner.start()

        var promises = this.getPkgsInfo(packagesToInstall)

        var self = this
        return Promise.all(promises).then(function (results) {
          spinner.stop(true)
          display.message(MESSAGES.CHECKED_PACKAGES)

          var addons = []
          var nonAddons = []
          results.forEach(function (result) {
            var pkg = packagesToInstallByName[result.name]
            if (self.isAddon(result)) {
              addons.push(pkg)
            } else {
              nonAddons.push(pkg)
            }
          })

          var addAddonsPromise = self.addAddonsToProject({ packages: addons })
          var addPkgsPromise
          if (!_.isEmpty(nonAddons)) {
            addPkgsPromise = self.addPackagesToProject(nonAddons)
          }

          return Promise.all([addAddonsPromise, addPkgsPromise])
        })
      }
    }
  },

  /**
   * Returns true if the package is an addon and false otherwise.
   * @param {object} pkgInfo the information of the package
   * @returns {boolean} true if the package is an addon and false otherwise
   */
  isAddon: function (pkgInfo) {
    return pkgInfo.keywords.indexOf('ember-addon') > -1
  },

  /**
   * Get the information for all the packages.
   * @param {array} packages a list of package
   * @returns {array} a list of promises to get the information of all the packages
   */
  getPkgsInfo: function (packages) {
    var promises = []
    packages.forEach(function (pkg) {
      promises.push(npm.view(packageHandler.toString(pkg.name, pkg)))
    })
    return promises
  },

  /**
   * Get the packages by name.
   * @param {array} packages a list of packages
   * @returns {object} the packages in an object
   */
  getPackagesByName: function (packages) {
    var packagesByName = {}
    if (!_.isEmpty(packages)) {
      packages.forEach(function (pkg) {
        packagesByName[pkg.name] = pkg
      })
    }
    return packagesByName
  },

  // == Recommended packages ==================================================
  /**
   * Get all the recommended groups (mandatory and optional).
   * Note: We are convertir all the single package to group to simplify their handling.
   * @param {object} options all the options
   * @param {object} existingPkgs the existing packages
   * @returns {object} contains all the groups.
   */
  getRecommendedGroups: function (options, existingPkgs) {
    var isThisAddonInstalled = externalApplicationUtil.isThisAddonInstalled(options)

    // Get the mandatory groups
    var mandatoryRequestedGroupsNPkgs = recommendedGroupsUtil.getMandatoryGroupsNPkgs(options)
    var mandatoryGroups = groupHandler.createRequestedGroups(mandatoryRequestedGroupsNPkgs, existingPkgs,
                        isThisAddonInstalled, true)

    // Get the optional groups
    var optionalRequestedGroupsNPkgs = recommendedGroupsUtil.getOptionalGroupsNPkgs(options)
    var optionalGroups = groupHandler.createRequestedGroups(optionalRequestedGroupsNPkgs, existingPkgs,
                        isThisAddonInstalled, false)

    // Get all the groups
    return _.merge(mandatoryGroups, optionalGroups, objUtil.mergeArray)
  },

  /**
   * Get the recommended packages.
   * @param {object} groups all recommended the groups
   * @returns {Promise} a promise that will return all the selected recommended packages
   */
  getSelectedRecommendedPkgs: function (groups) {
    return this.getSelectedPkgs(
      groups,
      QUESTION_RECOMMENDED_GROUPS,
      this.getChoiceForGroup.bind(this),
      this.getActionForRecommendedGroup)
  },

  /**
   * Get the action that will need to be done for a group.
   * @param {string} name name of the group
   * @param {object} group the group
   * @param {boolean} isInUserInput true if the user selected that group and false otherwise
   * @returns {string} the action for this group
   */
  getActionForRecommendedGroup: function (name, group, isInUserInput) {
    var action = actionsEnum.SKIP

    if (isInUserInput || group.isMandatory) {
      action = actionsEnum.OVERWRITE
    } else {
      if (group.state === statesEnum.INSTALLED) {
        action = actionsEnum.REMOVE
      }
    }

    return action
  },

  // == Other packages ========================================================
  /**
   * Get all the other groups.
   * Note: We are convertir all the single package to group to simplify their handling.
   * @param {object} existingPkgs the existing packages
   * @param {object} groupsToExclude all the groups that need to be excluded
   * @returns {object} contains all the other groups
   */
  getOtherGroups: function (existingPkgs, groupsToExclude) {
    var otherPackages = this.getOtherPkgs(existingPkgs, groupsToExclude)
    return groupHandler.createGroups(otherPackages)
  },

  /**
   * Get the other packages.
   * @param {object} existingPkgs the existing packages
   * @param {object} groupsToExclude the groups to exclude
   * @returns {object} contains all the other packages
   */
  getOtherPkgs: function (existingPkgs, groupsToExclude) {
    var otherPackages = {}
    var packagesToExclude = groupHandler.getPackageNames(groupsToExclude)

    for (var pkgName in existingPkgs) {
      var pkg = existingPkgs[pkgName]
      if (packagesToExclude.indexOf(pkgName) === -1) {
        otherPackages[pkgName] = pkg
      }
    }
    return otherPackages
  },

  /**
   * Get the other packages.
   * @param {object} groups all the other groups
   * @returns {Promise} a promise that will return all the other selected packages
   */
  getSelectedOtherPkgs: function (groups) {
    return this.getSelectedPkgs(
      groups,
      QUESTION_OTHER_GROUPS,
      this.getChoiceForGroup.bind(this),
      this.getActionForOtherGroup)
  },

  /**
   * Get the action that will need to be done for a group.
   * @param {string} name name of the group
   * @param {object} group the group
   * @param {boolean} isInUserInput true if the user selected that group and false otherwise
   * @returns {string} the action for this group
   */
  getActionForOtherGroup: function (name, group, isInUserInput) {
    var action = actionsEnum.SKIP

    if (group.state === statesEnum.INSTALLED) {
      if (isInUserInput) {
        action = actionsEnum.IDENTICAL
      } else {
        action = actionsEnum.REMOVE
      }
    }

    return action
  },

  // == Recommended and other packages ========================================
  /**
   * Get the choices for a group.
   * @param {string} name the name of the group
   * @param {object} group a group
   * @param {boolean} wasInUserInput true is the user previously selected that choice
   * @returns {object} the choice for a group
   */
  getChoiceForGroup: function (name, group, wasInUserInput) {
    return {
      value: name,
      name: groupHandler.toString(name, group),
      checked: (wasInUserInput === undefined) ? this.isGroupSelectedByDefault(group) : wasInUserInput,
      disabled: this.isGroupDisabledByDefault(group)
    }
  },

  /**
   * Returns true if the group is selected by default and false otherwise.
   * @param {object} group the group
   * @returns {boolean} true if the group is selected by default and false otherwise
   */
  isGroupSelectedByDefault: function (group) {
    return group.state === statesEnum.INSTALLED || group.isMandatory || this.isCandidateForAutomaticUpdate(group)
  },

  /**
   * Returns true if the group is a candidate for an automatic update and false otherwise.
   * @param {object} group the group
   * @returns {boolean} true if the group is a candidate for an automatic update and false otherwise
   */
  isCandidateForAutomaticUpdate: function (group) {
    return group.state === statesEnum.NEED_UPDATE && group.isThisAddonInstalled
  },

  /**
   * Returns true if the group is disabled by default and false otherwise.
   * @param {object} group the group
   * @returns {boolean} true if the group is disabled by default and false otherwise
   */
  isGroupDisabledByDefault: function (group) {
    if (group.isMandatory) {
      return MANDATORY_TO_STR
    }

    return false
  },

  // == User Input ============================================================
  /**
   * Get choices for the groups based on the function passed in parameter.
   * @param {object} groups all the groups the user can select
   * @param {object} question the question to ask to the user
   * @param {function} getChoicesFct the function call to get the choices
   * @param {object} previousUserInputs the previous user inputs (will be null on the first call of this method)
   * @returns {object} all the choices
   */
  getChoices: function (groups, question, getChoicesFct, previousUserInputs) {
    var choicesSelectedPreviously = (previousUserInputs === undefined) ? undefined : previousUserInputs[question.name]
    return userInputHandler.getChoices(groups, getChoicesFct, choicesSelectedPreviously)
  },

  /**
   * Get the selection of the user.
   * @param {object} groups all the groups the user can select
   * @param {object} question the question to ask to the user
   * @param {function} getChoicesFct the function call to get the choices
   * @param {function} getActionByGroupFct the function call to get the actiond by group
   * @param {object} previousUserInputs the previous user inputs (will be null on the first call of this method)
   * @returns {Promise} a promise that will return all the selected groups
   */
  getSelectedPkgs: function (groups, question, getChoicesFct, getActionByGroupFct, previousUserInputs) {
    var choices = this.getChoices(groups, question, getChoicesFct, previousUserInputs)
    var promise = this.getUserInputForGroups(groups, question, choices)
    if (promise) {
      var self = this
      return promise.then(function (userInputs) {
        // Once we get the input of the user, we display a summary and we ask
        // the user to confirm the action for each group.
        var actionByGroup = actionHandler.getByEntity(groups,
                                        userInputs[question.name],
                                        getActionByGroupFct)
        // Display summary
        self.displaySummary(groups, actionByGroup)
        // Confirm choices
        return self.getConfirmedPkgsSelected(
          actionByGroup,
          { fct: self.getPackagesToModify.bind(self),
            params: {
              groups: groups,
              actionByGroup: actionByGroup
            }
          },
          { fct: self.getSelectedPkgs.bind(self),
            params: {
              groups: groups,
              question: question,
              getChoicesFct: getChoicesFct,
              getActionByGroupFct: getActionByGroupFct,
              userInputs: userInputs
            }
          })
      })
    }
  },

  /**
   * Get the packages to modify  by action for all the groups.
   * @param {object} groups all the groups
   * @param {object} actionByGroup the action that will be done for each group
   * @returns {object} a list of packages by action
   */
  getPackagesToModify: function (groups, actionByGroup) {
    var packagesByAction = {}
    for (var groupName in groups) {
      var group = groups[groupName]
      var action = actionByGroup[groupName]

      var pkgsToModifyByAction = this.getPackagesToModifyByActionForGroup(group, action)
      if (!_.isEmpty(pkgsToModifyByAction)) {
        var currentPackagesByAction = packagesByAction[action]

        if (!currentPackagesByAction) {
          currentPackagesByAction = []
        }

        packagesByAction[action] = currentPackagesByAction.concat(pkgsToModifyByAction[action])
      }
    }

    return packagesByAction
  },

  /**
   * Get the packages to modify  by action for this group.
   * @param {object} group the group
   * @param {string} action the action to do on the group
   * @returns {object} a list of packages by action
   */
  getPackagesToModifyByActionForGroup: function (group, action) {
    var packagesToModifyByAction = {}
    if (action === actionsEnum.OVERWRITE || action === actionsEnum.REMOVE) {
      packagesToModifyByAction[action] = groupHandler.getPkgsBy(group, packageHandler.getPackageObj)
    }

    return packagesToModifyByAction
  },

  /**
   * Prompt the user to confirm the actions selected for each group.
   * @param {object} actionByGroup the action that will be done for each group
   * @param {object} getSelected the function call to get the selected packages and it's parameters
   * @param {object} goBackToSelection the function call to get go back to the selection and it's parameters
   * @returns {Promise} a promise that will return back the user to the selection or
   *          {object} a list of the packages selected
   */
  getConfirmedPkgsSelected: function (actionByGroup, getSelected, goBackToSelection) {
    if (this.isConfirmationRequired(actionByGroup)) {
      return this.getConfirmationUserInput(QUESTION_CONFIRM).then(function (confirmUserInput) {
        var params
        if (confirmUserInput[QUESTION_CONFIRM.name]) {
          display.carriageReturn()
          params = getSelected.params
          return getSelected.fct(params.groups, params.actionByGroup)
        } else {
          params = goBackToSelection.params
          return goBackToSelection.fct(params.groups, params.question, params.getChoicesFct,
            params.getActionByGroupFct, params.userInputs)
        }
      })
    }
  },

  /**
   * Prompt the user for a confirmation.
   * @param {object} question the question to ask the user
   * @returns {Promise} the promise containing the user input
   */
  getConfirmationUserInput: function (question) {
    return userInputHandler.getUserInputForChoice(this,
      {type: 'confirm', name: question.name, message: question.message}, [])
  },

  /**
   * Returns true if the confirmation is required for the actions to be done by groups and false otherwise.
   * @param {object} actionByGroup the action that will be done for each group
   * @returns {boolean} true if the confirmation is required for the actions to be done by groups and false otherwise
   */
  isConfirmationRequired: function (actionByGroup) {
    return actionHandler.isAnyActionCompliant(actionByGroup, this.isConfirmationRequiredForGroup)
  },

  /**
   * Returns true if a confirmation is required for this group and false otherwise.
   * @param {string} action the action to do on the group
   * @returns {boolean} true if a confirmation is required for this group and false otherwise
   */
  isConfirmationRequiredForGroup: function (action) {
    return action !== actionsEnum.IDENTICAL
  },

  /**
   * Prompt the user with a set of choices for the groups.
   * @param {object} groups an object containing all the groups
   * @param {object} question the question to ask the user
   * @param {array} choices the choices that will be shown to the user
   * @returns {Promise} the promise containing the user input
   */
  getUserInputForGroups: function (groups, question, choices) {
    if (!_.isEmpty(choices)) {
      return userInputHandler.getUserInputForChoice(this,
        {type: 'checkbox', name: question.name, message: question.message}, choices)
    }
  },

  // == Summary ===============================================================
  /**
   * Display the summary for all the groups.
   * @param {object} groups all the groups
   * @param {object} actionByGroup the action that will be done for each group
   */
  displaySummary: function (groups, actionByGroup) {
    display.title(MESSAGES.SUMMARY)
    for (var groupName in groups) {
      display.message(this.getSummaryByGroup(groupName, groups[groupName], actionByGroup[groupName]))
    }
  },

  /**
   * Get the summary for a group.
   * @param {string} name the name of the group
   * @param {object} group a group
   * @param {string} action the action to do on the group
   * @returns {string} a summary for a group
   */
  getSummaryByGroup: function (name, group, action) {
    if (name && group && action) {
      return actionHandler.toString(action) + ' ' +
        groupHandler.toString(name, group) + ' ' +
        ((groupHandler.isDowngrade(group)) ? display.getWarning('Downgrade') : '')
    }
  }
}

