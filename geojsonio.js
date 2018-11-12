#! /usr/bin/env node

const concat = require('concat-stream'),
      opener = require('opener'),
      tty = require('tty'),
      path = require('path'),
      fs = require('fs'),
      os = require('os'),
      validator = require('@mapbox/geojsonhint'),
      octokit = require('@octokit/rest')(),
      argv = require('minimist')(process.argv.slice(2)),
      MAX_URL_LEN = 150e3,
      BIG_LEN = 5000000

const token = fs.readFileSync(
  path.join(os.homedir(), '.geojsonio'), {encoding: 'utf8'}
).trim()

if (argv.help || argv.h || !(argv._[0] || !tty.isatty(0))) {
  return help()
}

((argv._[0] && fs.createReadStream(argv._[0])) || process.stdin)
  .pipe(concat(openData))

function openData(body) {
  if (body.length > BIG_LEN) {
    console.error(
      'This file is large and will display slowly on geojson.io')
  }
  if (body.length <= MAX_URL_LEN) {
    const messages = validator.hint(JSON.parse(body.toString()))
    const errors = messages.filter(
      message => (! message.hasOwnProperty('level')
                  || message.level !== 'message')
    )
    if (errors.length == 0) {
      messages.forEach(({message}) => console.log(message))
      displayResource('#data=data:application/json,' + encodeURIComponent(
        JSON.stringify(JSON.parse(body.toString()))))
    } else {
      console.log('This is not valid GeoJSON. Errors:\n')
      errors.forEach(({message}) => console.log(message))
    }
  } else {
    octokit.authenticate({type: 'token', token})
    octokit.gists.create({
      public: true,
      files: {
        'map.geojson': {
          content: JSON.stringify(JSON.parse(body.toString()))
        }
      }
    })
    .then(
      res => {
        displayResource('#id=gist:/' + res.data.id)
      }
    )
    .catch(
      err => console.error('Unable to create Gist: ' + JSON.stringify(err))
    )
  }
}

function displayResource(path) {
  try {
    (argv.print ? console.log : opener)(
      (argv.domain || 'http://geojson.io/') + path)
  } catch(e) {
    console.error('Valid GeoJSON file required as input.')
    help()
  }
}

function help() {
  fs.createReadStream(path.join(__dirname, 'README.md')).pipe(process.stdout)
}
