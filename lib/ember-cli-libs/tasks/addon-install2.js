'use strict'

var Task = require('ember-cli/lib/models/task')
var merge = require('ember-cli-lodash-subset').merge
var getPackageBaseName = require('ember-cli/lib/utilities/get-package-base-name')
var Promise = require('ember-cli/lib/ext/promise')

module.exports = Task.extend({
  init: function () {
    this._super.apply(this, arguments)
    this.NpmInstallTask = this.NpmInstallTask || require('./npm-install2')
    this.BlueprintTask = this.BlueprintTask || require('ember-cli/lib/tasks/generate-from-blueprint')
  },

  run: function (options) {
    var chalk = require('chalk')
    var ui = this.ui
    var packageNames = options.packages
    var blueprintOptions = options.blueprintOptions || {}
    var commandOptions = blueprintOptions

    var npmInstall = new this.NpmInstallTask({
      ui: this.ui,
      analytics: this.analytics,
      project: this.project
    })

    var blueprintInstall = new this.BlueprintTask({
      ui: this.ui,
      analytics: this.analytics,
      project: this.project,
      testing: this.testing
    })

    ui.startProgress(chalk.green('Installing addon package'), chalk.green('.'))

    return npmInstall.run({
      'packages': packageNames,
      'save-dev': !commandOptions.save && commandOptions.saveDev,
      'save-exact': commandOptions.saveExact
    }).then(function () {
      return this.project.reloadAddons()
    }.bind(this)).then(function () {
      return this.installBlueprint(blueprintInstall, packageNames, blueprintOptions)
    }.bind(this))
    .finally(function () { ui.stopProgress() })
    .then(function () {
      ui.writeLine(chalk.green('Installed addon package.'))
    })
  },

  installBlueprint: function (install, packageNames, blueprintOptions) {
    var blueprintName, taskOptions, addonInstall = this

    return packageNames.reduce(function (promise, packageName) {
      return promise.then(function () {
        blueprintName = addonInstall.findDefaultBlueprintName(packageName)
        if (blueprintName) {
          taskOptions = merge({
            args: [blueprintName],
            ignoreMissingMain: true
          }, blueprintOptions || {})

          return install.run(taskOptions)
        } else {
          addonInstall.ui.writeWarnLine('Could not figure out blueprint name from: "' + packageName +
            '". Please install the addon blueprint via "ember generate <addon-name>" if necessary.')
        }
      })
    }, Promise.resolve())
  },

  findDefaultBlueprintName: function (givenName) {
    var packageName = getPackageBaseName(givenName)
    if (!packageName) {
      return null
    }

    var addon = this.project.findAddonByName(packageName)
    if (!addon) {
      console.log('Install failed. Could not find addon with name: ' + givenName)
    }

    var emberAddon = addon.pkg['ember-addon']

    if (emberAddon && emberAddon.defaultBlueprint) {
      return emberAddon.defaultBlueprint
    }

    return packageName
  }
})