'use strict'

var blueprintHelpers = require('ember-cli-blueprint-test-helpers/helpers')
var setupTestHooks = blueprintHelpers.setupTestHooks
var emberNew = blueprintHelpers.emberNew
var emberGenerate = blueprintHelpers.emberGenerate
var modifyPackages = blueprintHelpers.modifyPackages

var chai = require('ember-cli-blueprint-test-helpers/chai')
var expect = chai.expect

var mocha = require('mocha')
var it = mocha.it
var describe = mocha.describe
var beforeEach = mocha.beforeEach
var afterEach = mocha.afterEach

var td = require('testdouble')

var requireFromCLI = require('ember-cli-blueprint-test-helpers/lib/helpers/require-from-cli')
var Blueprint = requireFromCLI('lib/models/blueprint')
var MockUI = requireFromCLI('tests/helpers/mock-ui')

var otherPkgsToSelectByDefaylt = [
  'broccoli-asset-rev',
  'ember-ajax',
  'ember-cli',
  'ember-cli-app-version',
  'ember-cli-babel',
  'ember-cli-dependency-checker',
  'ember-cli-htmlbars',
  'ember-cli-htmlbars-inline-precompile',
  'ember-cli-inject-live-reload',
  'ember-cli-jshint',
  'ember-cli-qunit',
  'ember-cli-release',
  'ember-cli-sri',
  'ember-cli-test-loader',
  'ember-cli-uglify',
  'ember-data',
  'ember-export-application-global',
  'ember-load-initializers',
  'ember-resolver',
  'ember-welcome-page',
  'loader.js'
]

var installedPkgsMochaCoreD3 = [
  {name: 'ember-cli-mocha', version: '0.2.0', dev: true},         // installed
  {name: 'ember-frost-core', version: '0.25.3', dev: true},       // installed
  {name: 'ember-d3', version: '0.2.0', dev: true}                 // installed
]
var installedPkgsChai = [
  {name: 'ember-cli-mocha', version: '0.2.0', dev: true}        // installed
]

describe('Acceptance: ember generate ember-cli-ecosystem-installer', function () {
  setupTestHooks(this)

  var prompt, packagesToInstall, packagesToUninstall
  beforeEach(function () {
    // Mock the UI prompt to avoid prompting during tests
    prompt = td.function()
    td.replace(MockUI.prototype, 'prompt', prompt)

    // Mock the behavior on install to get the packages installed
    var installTaskRun = td.function()
    td.when(installTaskRun(td.matchers.anything())).thenDo(function (task) { packagesToInstall = task.packages })

    // Mock the behavior on uninstall to get the packages uninstall
    var uninstallTaskRun = td.function()
    td.when(uninstallTaskRun(td.matchers.anything())).thenDo(function (task) { packagesToUninstall = task.packages })

    // Mock the behavior on addon-install
    var taskFor = td.function()
    td.when(taskFor('addon-install')).thenReturn({ run: installTaskRun })
    td.when(taskFor('npm-uninstall')).thenReturn({ run: uninstallTaskRun })

    td.replace(Blueprint.prototype, 'taskFor', taskFor)

    packagesToInstall = null
    packagesToUninstall = null
  })

  afterEach(function () {
    td.reset()
  })

  it('No package to install (empty file)', function () {
    var args = ['ember-cli-ecosystem-installer', '--lts-file=node-tests/mock/empty-lts.json']
    td.when(prompt(td.matchers.anything())).thenResolve({
      userInputOtherGroups: otherPkgsToSelectByDefaylt,
      confirmSelection: 'y'
    })

    return emberNew()
      .then(function () { emberGenerate(args) })
      .then(function () {
        expect(packagesToInstall)
          .to.be.eql(null)
      })
  })

  it('Single package', function () {
    var args = ['ember-cli-ecosystem-installer', '--lts-file=node-tests/mock/single-package-lts.json']
    td.when(prompt(td.matchers.anything())).thenResolve({
      userInputRecommendGroups: ['ember-prop-types'],
      userInputOtherGroups: otherPkgsToSelectByDefaylt,
      confirmSelection: 'y'
    })

    return emberNew()
      .then(function () { return emberGenerate(args) })
      .then(function () {
        expect(packagesToInstall)
          .to.have.lengthOf(1)
          .to.contain('ember-prop-types@~3.0.0')
      })
  })

  it('Single group', function () {
    var args = ['ember-cli-ecosystem-installer', '--lts-file=node-tests/mock/single-group-lts.json']
    td.when(prompt(td.matchers.anything())).thenResolve({
      userInputRecommendGroups: ['package3'],
      userInputOtherGroups: otherPkgsToSelectByDefaylt,
      confirmSelection: 'y'
    })

    return emberNew()
      .then(function () { return emberGenerate(args) })
      .then(function () {
        expect(packagesToInstall)
          .to.have.lengthOf(1)
          .to.contain('ember-cli-mocha@0.2.0')
      })
  })

  describe('Package and group', function () {
    var args
    beforeEach(function () {
      args = ['ember-cli-ecosystem-installer', '--lts-file=node-tests/mock/package-group-lts.json']
    })

    describe('User request', function () {
      it('User request only 1 group', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['package3'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(1)
              .to.contain('ember-cli-mocha@0.2.0')
          })
      })

      it('User request everything', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['package3', 'package4', 'ember-prop-types'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(4)
              .to.contain('ember-cli-mocha@0.2.0')
              .to.contain('ember-prop-types@~3.0.0')
              .to.contain('ember-frost-core@0.25.3')
              .to.contain('ember-d3@0.2.0')
          })
      })

      it('User request install recommended package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['ember-prop-types'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(1)
              .to.contain('ember-prop-types@~3.0.0')
          })
      })

      it('User request uninstall recommended package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages([
              {name: 'ember-prop-types', version: '~3.0.0', dev: true}  // installed
            ])
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.be.eql(null)
          })
          .then(function () {
            expect(packagesToUninstall)
              .to.have.lengthOf(1)
              .to.contain('ember-prop-types')
          })
      })

      it('User request install + uninstall recommended package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['ember-prop-types'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages([
              {name: 'ember-d3', version: '0.2.0', dev: true},          // installed
              {name: 'ember-frost-core', version: '0.25.3', dev: true}  // installed
            ])
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(1)
              .to.contain('ember-prop-types@~3.0.0')
          })
          .then(function () {
            expect(packagesToUninstall)
              .to.have.lengthOf(2)
              .to.contain('ember-d3')
              .to.contain('ember-frost-core')
          })
      })

      it('User request uninstall other package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages(installedPkgsChai)
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.be.eql(null)
          })
          .then(function () {
            expect(packagesToUninstall)
              .to.have.lengthOf(1)
              .to.contain('ember-cli-mocha')
          })
      })

      it('User request install + uninstall recommended package and unistall other package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['ember-prop-types'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages([
              {name: 'ember-d3', version: '0.2.0', dev: true},            // installed
              {name: 'ember-frost-core', version: '0.25.3', dev: true},   // installed
              {name: 'ember-cli-mocha', version: '0.2.0', dev: true}      // installed
            ])
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(1)
              .to.contain('ember-prop-types@~3.0.0')
          })
          .then(function () {
            expect(packagesToUninstall)
              .to.have.lengthOf(3)
              .to.contain('ember-d3')
              .to.contain('ember-frost-core')
              .to.contain('ember-cli-mocha')
          })
      })
    })

    describe('Recommended packages - Action based on selection', function () {
      describe('Selected', function () {
        it('Group containing only new packages', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputRecommendGroups: ['package3', 'package4'],
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToInstall)
                .to.have.lengthOf(3)
                .to.contain('ember-cli-mocha@0.2.0')
                .to.contain('ember-d3@0.2.0')
                .to.contain('ember-frost-core@0.25.3')
            })
        })

        it('Group containing only packages to update', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputRecommendGroups: ['package3', 'package4'],
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () {
              modifyPackages([
                {name: 'ember-cli-mocha', version: '0.1.0', dev: true},         // to update
                {name: 'ember-frost-core', version: '0.25.2', dev: true},       // to update
                {name: 'ember-d3', version: '0.1.0', dev: true}                 // to update
              ])
            })
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToInstall)
                .to.have.lengthOf(3)
                .to.contain('ember-cli-mocha@0.2.0')
                .to.contain('ember-d3@0.2.0')
                .to.contain('ember-frost-core@0.25.3')
            })
        })

        it('Group containing packages already installed', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputRecommendGroups: ['package3', 'package4'],
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () {
              modifyPackages(installedPkgsMochaCoreD3)
            })
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToInstall)
                .to.have.lengthOf(3)
                .to.contain('ember-cli-mocha@0.2.0')
                .to.contain('ember-d3@0.2.0')
                .to.contain('ember-frost-core@0.25.3')
            })
        })
      })

      describe('Not selected', function () {
        it('Group containing only new packages', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToInstall)
                .to.be.eql(null)
            })
        })

        it('Group containing only packages to update', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () {
              modifyPackages([
                {name: 'ember-cli-mocha', version: '0.1.0', dev: true},         // to update
                {name: 'ember-frost-core', version: '0.25.1', dev: true},       // to update
                {name: 'ember-d3', version: '0.1.0', dev: true}                 // to update
              ])
            })
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToInstall)
                .to.be.eql(null)
            })
        })

        it('Group containing packages already installed', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () {
              modifyPackages(installedPkgsMochaCoreD3)
            })
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToInstall)
                .to.be.eql(null)
            })
            .then(function () {
              expect(packagesToUninstall)
                .to.have.lengthOf(3)
                .to.contain('ember-cli-mocha')
                .to.contain('ember-d3')
                .to.contain('ember-frost-core')
            })
        })
      })
    })

    describe('Other packages - Action based on selection', function () {
      describe('Selected', function () {
        it('Group containing packages already installed', function () {
          var otherPkgsSelected = otherPkgsToSelectByDefaylt.concat(['ember-cli-mocha2'])
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputOtherGroups: otherPkgsSelected,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () {
              modifyPackages([
                {name: 'ember-cli-mocha2', version: '0.2.0', dev: true}        // installed
              ])
            })
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToUninstall)
                .to.be.eql(null)
            })
        })
      })

      describe('Not selected', function () {
        it('Group containing packages already installed', function () {
          td.when(prompt(td.matchers.anything())).thenResolve({
            userInputOtherGroups: otherPkgsToSelectByDefaylt,
            confirmSelection: 'y'
          })

          return emberNew()
            .then(function () {
              modifyPackages(installedPkgsChai)
            })
            .then(function () { return emberGenerate(args) })
            .then(function () {
              expect(packagesToUninstall)
                .to.have.lengthOf(1)
                .to.contain('ember-cli-mocha')
            })
        })
      })
    })

    describe('Group with mixed package states', function () {
      it('Group containing package to update and new package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['package3', 'package4'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages([
              {name: 'ember-cli-mocha', version: '0.2.0', dev: true},         // installed
              {name: 'ember-frost-core', version: '0.25.2', dev: true}        // to update
            ])
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(3)
              .to.contain('ember-cli-mocha@0.2.0')
              .to.contain('ember-d3@0.2.0')
              .to.contain('ember-frost-core@0.25.3')
          })
      })

      it('Group containing package already installed and new package', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['package3', 'package4'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages([
              {name: 'ember-cli-mocha', version: '0.2.0', dev: true},       // installed
              {name: 'ember-d3', version: '0.2.0', dev: true}               // installed
            ])
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(3)
              .to.contain('ember-cli-mocha@0.2.0')
              .to.contain('ember-d3@0.2.0')
              .to.contain('ember-frost-core@0.25.3')
          })
      })

      it('Group containing package already installed and package to update', function () {
        td.when(prompt(td.matchers.anything())).thenResolve({
          userInputRecommendGroups: ['package3', 'package4'],
          userInputOtherGroups: otherPkgsToSelectByDefaylt,
          confirmSelection: 'y'
        })

        return emberNew()
          .then(function () {
            modifyPackages([
              {name: 'ember-cli-mocha', version: '0.2.0', dev: true},       // installed
              {name: 'ember-frost-core', version: '0.25.2', dev: true},     // to update
              {name: 'ember-d3', version: '0.2.0', dev: true}               // installed
            ])
          })
          .then(function () { return emberGenerate(args) })
          .then(function () {
            expect(packagesToInstall)
              .to.have.lengthOf(3)
              .to.contain('ember-cli-mocha@0.2.0')
              .to.contain('ember-d3@0.2.0')
              .to.contain('ember-frost-core@0.25.3')
          })
      })
    })
  })

  describe('Mandatory', function () {
    var args
    beforeEach(function () {
      args = ['ember-cli-ecosystem-installer', '--lts-file=node-tests/mock/package-group-lts-mandatory.json']
    })

    it('Already installed package', function () {
      td.when(prompt(td.matchers.anything())).thenResolve({
        userInputRecommendGroups: ['ember-cli-chai'],
        userInputOtherGroups: otherPkgsToSelectByDefaylt,
        confirmSelection: 'y'
      })

      return emberNew()
        .then(function () {
          modifyPackages([
            {name: 'ember-cli-chai', version: '0.0.10', dev: true}       // installed
          ])
        })
        .then(function () { return emberGenerate(args) })
        .then(function () {
          expect(packagesToInstall)
            .to.have.lengthOf(1)
            .to.contain('ember-cli-chai@0.0.10')
        })
    })

    it('Package require update', function () {
      td.when(prompt(td.matchers.anything())).thenResolve({
        // We need to mock this but those will be selected by default since this package is mandatory
        userInputRecommendGroups: ['ember-cli-chai'],
        userInputOtherGroups: otherPkgsToSelectByDefaylt,
        confirmSelection: 'y'
      })

      return emberNew()
        .then(function () {
          modifyPackages([
            {name: 'ember-cli-chai', version: '0.1.0', dev: true}       // to update
          ])
        })
        .then(function () { return emberGenerate(args) })
        .then(function () {
          expect(packagesToInstall)
            .to.have.lengthOf(1)
            .to.contain('ember-cli-chai@0.0.10')
        })
    })

    it('New package', function () {
      td.when(prompt(td.matchers.anything())).thenResolve({
        // We need to mock this but those will be selected by default since this package is mandatory
        userInputRecommendGroups: ['ember-cli-chai'],
        userInputOtherGroups: otherPkgsToSelectByDefaylt,
        confirmSelection: 'y'
      })

      return emberNew()
        .then(function () { return emberGenerate(args) })
        .then(function () {
          expect(packagesToInstall)
            .to.have.lengthOf(1)
            .to.contain('ember-cli-chai@0.0.10')
        })
    })
  })

  describe('Mandatory + Optional', function () {
    var args
    beforeEach(function () {
      args = ['ember-cli-ecosystem-installer', '--lts-file=node-tests/mock/package-group-lts-mandatory-optional.json']
    })

    it('Already installed package', function () {
      td.when(prompt(td.matchers.anything())).thenResolve({
        userInputRecommendGroups: ['ember-cli-chai', 'ember-cli-mocha'],
        userInputOtherGroups: otherPkgsToSelectByDefaylt,
        confirmSelection: 'y'
      })

      return emberNew()
        .then(function () {
          modifyPackages([
            {name: 'ember-cli-chai', version: '0.0.10', dev: true},         // installed
            {name: 'ember-cli-mocha', version: '0.2.0', dev: true}          // installed
          ])
        })
        .then(function () { return emberGenerate(args) })
        .then(function () {
          expect(packagesToInstall)
            .to.have.lengthOf(2)
            .to.contain('ember-cli-chai@0.0.10')
            .to.contain('ember-cli-mocha@0.2.0')
        })
    })

    it('Package require update', function () {
      td.when(prompt(td.matchers.anything())).thenResolve({
        // We need to mock this but those will be selected by default since this package is mandatory (ember-cli-chai)
        userInputRecommendGroups: ['ember-cli-chai', 'ember-cli-mocha'],
        userInputOtherGroups: otherPkgsToSelectByDefaylt,
        confirmSelection: 'y'
      })

      return emberNew()
        .then(function () {
          modifyPackages([
            {name: 'ember-cli-chai', version: '0.0.9', dev: true},          // to update
            {name: 'ember-cli-mocha', version: '0.1.0', dev: true}          // to update
          ])
        })
        .then(function () { return emberGenerate(args) })
        .then(function () {
          expect(packagesToInstall)
            .to.have.lengthOf(2)
            .to.contain('ember-cli-chai@0.0.10')
            .to.contain('ember-cli-mocha@0.2.0')
        })
    })

    it('New package', function () {
      td.when(prompt(td.matchers.anything())).thenResolve({
        // We need to mock this but those will be selected by default since this package is mandatory (ember-cli-chai)
        userInputRecommendGroups: ['ember-cli-chai', 'ember-cli-mocha'],
        userInputOtherGroups: otherPkgsToSelectByDefaylt,
        confirmSelection: 'y'
      })

      return emberNew()
        .then(function () { return emberGenerate(args) })
        .then(function () {
          expect(packagesToInstall)
            .to.have.lengthOf(2)
            .to.contain('ember-cli-chai@0.0.10')
            .to.contain('ember-cli-mocha@0.2.0')
        })
    })
  })
})
