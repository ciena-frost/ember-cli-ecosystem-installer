[ci-img]: https://img.shields.io/travis/ciena-frost/ember-frost-lts.svg "Travis CI Build Status"
[ci-url]: https://travis-ci.org/ciena-frost/ember-frost-lts

[cov-img]: https://img.shields.io/coveralls/ciena-frost/ember-frost-lts.svg "Coveralls Code Coverage"
[cov-url]: https://coveralls.io/github/ciena-frost/ember-frost-lts

[npm-img]: https://img.shields.io/npm/v/ember-frost-lts.svg "NPM Version"
[npm-url]: https://www.npmjs.com/package/ember-frost-lts

[![Travis][ci-img]][ci-url] [![Coveralls][cov-img]][cov-url] [![NPM][npm-img]][npm-url]

Work in progress !

----
TODO update the documentation

# ember-frost-lts

 * [Installation](#Installation)
 * [Usage](#Usage)
 * [Development](#Development)

## Installation
```
ember install ember-frost-lts
```

On the install or generate the user will be requested to install packages/groups of packages. 

If the user answer y or yes the package or group of package will be installed and otherwise it will not be installed.

## Usage
In the following example the package1, package2 and package3 will be installed.
```bash
ember g ember-frost-lts
installing ember-frost-lts
Would you like to install the following packages:
? Overwrite group-name (package1@package-version, package2@package-version)? Yes
? Overwrite package3@package-version? Yes
```

If there is any invalid package/group in your lts.json file you will get the following error message
```bash
ember g ember-frost-lts
installing ember-frost-lts
Would you like to install the following packages:
Invalid package: package1
Invalid group: package2
```

## Development
### Setup
```
git clone git@github.com:ciena-frost/ember-frost-lts.git
cd ember-frost-lts
npm install && bower install
```
### Add new packages/groups to install
If you want to add new packages/groups to install you simply have to modify the lts.json file and use the following format:
```json
{
  "group-name": {
    "packages": {
      "package-name": "package-version"
    }
  },
  "package-name": "package-version"
}
```

### Development Server
A dummy application for development is available under `ember-frost-lts/tests/dummy`.
To run the server run `ember server` (or `npm start`) from the root of the repository and
visit the app at http://localhost:4200.

### Testing
Run `npm test` from the root of the project to run linting checks as well as execute the test suite
and output code coverage.
