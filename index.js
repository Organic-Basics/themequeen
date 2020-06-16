const axios = require('axios')
const fs = require('fs')
const path = require('path')
const colors = require('colors')
const FileType = require('file-type');
// Notifies as part of other tasks
const notifier = require('node-notifier');
// Prompts users before doing something
const readlineSync = require('readline-sync');
// A better way of watching files
const chokidar = require('chokidar');

let themeSettings = { name: 'development' }
let themeDir = 'theme/'

// instantiate the watcher
let watcher

require('dotenv').config({ path: 'theme/variables' })

let fileQueueInterval

const yaml = require('js-yaml');
// Gets the arguments passed via the command line, such as '--env test-dk'
const argv = require('yargs').argv;
// Get the specified --env argument, if present. If not, then just use 'development'
let themeEnv = (argv.env === undefined) ? 'development' : argv.env;
// Get the specified argument, if present. If not, then just set to false
let shouldOpen = (argv.open === undefined) ? false : true;
let shouldForce = (argv.force === undefined) ? false : true;

// Load config for this environment
let config

function init() {
  config = yaml.safeLoad(fs.readFileSync(themeDir + 'config.yml', 'utf8'));
  if(config[themeEnv] !== undefined) {
    let themeVals = config[themeEnv]
    for(let val in themeVals) {
      if(themeVals[val] !== undefined) {
          let themeEnvVal = themeVals[val]
          let themeName = themeEnvVal.replace(/[\{\}\$]/g, '')
          let themeVal = process.env[themeName]
          if(val === 'theme_id') themeVal = parseInt(themeVal)
          themeSettings[val] = themeVal
      }
    }
  }
}

function startFileQueue() {
  // With a 500ms delay, update the files in that were put into the watch queue
  fileQueueInterval = setInterval(function() {
    if(watchQueue.length > 0) {
      let next = watchQueue.shift()
      next.call().then((res) => {
        console.log(res)
      }).catch((err) => {
        console.error(err)
      })
    }
  }, 250)
}

function monitorFiles(filename, newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    console.log('👸 notices "' + filename.yellow + '" was changed.')
    fs.access(filename, fs.constants.F_OK, (err) => {
      // File doesn't exist; delete it
      if(err) {
        deleteFile(filename, newThemeSettings).then((response) => {
          resolve(response)
        }).catch((err) => {
          reject(err)
        })
      }
      // File does exist; update or create it
      else {
        updateFile(filename, newThemeSettings).then((response) => {
          resolve(response)
        }).catch((err) => {
          reject(err)
        })
      }
    })
  })
}

function updateFile(filename, newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    FileType.fromFile(filename).then((fileDat) => {
      let encoding = 'utf8'
      if(fileDat !== undefined) {
        if(!fileDat.mime.includes('text')) {
          encoding = 'base64'
        }
      }

      fs.readFile(filename, encoding, (err, data) => {
        let transferData
        filename = filename.replace(themeDir, '')
        if(encoding === 'base64') {
          transferData = {
            asset: {
              key: filename,
              attachment: data
            }
          }
        }
        else {
          transferData = {
            asset: {
              key: filename,
              value: data
            }
          }
        }

        if (err) throw err
        axios({
          method: 'put',
          data: transferData,
          url: `https://${newThemeSettings.store}/admin/api/2020-01/themes/${newThemeSettings.theme_id}/assets.json`,
          headers: {
            'User-Agent': 'Gulp',
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': `${newThemeSettings.password}`
          }
        }).then((response) => {
          resolve('👸 decrees that "' + response.data.asset.key.green + '" was updated on ' + newThemeSettings.name.cyan + '.')
        }).catch((err) => {
          let errMsg = 'Unknown error.'
          if(err.response !== undefined) {
            try {
              errMsg = '\n'
              if(err.response.data.errors.asset !== undefined) {
                for(let e of err.response.data.errors.asset) {
                  errMsg += e.red
                }
              }
            } catch(err) {
              // console.log(err)
            }
          }
          reject('👸 couldn\'t update file '.red + filename.cyan + ': ' + errMsg)
        })
      })
    })
  })
}

function deleteFile(filename, newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    if(filename.includes('.woff')) {
      process.stdout.write('\n')
      console.log('👸 currently doesn\'t support .woff files. Sorry about that!'.red)
      resolve('👸 currently doesn\'t support .woff files. Sorry about that!'.red)
    }

    axios({
      method: 'delete',
      url: `https://${newThemeSettings.store}/admin/api/2020-01/themes/${newThemeSettings.theme_id}/assets.json?asset[key]=${filename}`,
      headers: {
        'X-Shopify-Access-Token': `${newThemeSettings.password}`
      }
    }).then((response) => {
      let msg = '👸 decrees that "' + filename.red + '" was deleted.'
      resolve(msg)
    }).catch((err) => {
      let errMsg = 'Unknown error.'
      try {
        if(err.response !== undefined && err.response.status !== 403) {
          errMsg = '\n'
          console.log(err)
          errMsg += err.response.data.message
        }
      } catch(err) {}
      reject('👸 couldn\'t delete file '.red + filename.cyan + ': ' + errMsg)
    })
  })
}

async function uploadTheme(newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://${newThemeSettings.store}/admin/api/2020-01/themes/${newThemeSettings.theme_id}/assets.json`,
      headers: {
        'X-Shopify-Access-Token': `${newThemeSettings.password}`
      }
    }).then(async function(response) {
      let localFiles = getAllFiles(themeDir)
      let onlineFiles = response.data.assets
      console.log('👸 is satisfied. '.cyan + localFiles.length + ' local subjects, and ' + onlineFiles.length + ' online subjects were found.')

      let count = 0
      for(let asset of onlineFiles) {
        if(!localFiles.includes(asset.key)) {
          await deleteFile(asset.key, newThemeSettings).then((response) => {
            localFiles.splice(localFiles.indexOf(asset.key), 1)
          }).catch((err) => {
            if(err.response !== undefined) {
              if(err.response.status !== 403 && err.response.status !== 422 && err.response.status !== 404) {
                console.error(err.response)
              }
            }
          })
        }
        let progressStr = '👸 is hard at work deleting files. '.cyan + ((count / onlineFiles.length) * 100).toFixed(0) + '% finished so far.'
        if(process.env.BUILD_PLATFORM !== 'github') {
          process.stdout.clearLine()
          process.stdout.cursorTo(0)
          process.stdout.write(progressStr)
        }
        else {
          console.log(progressStr)
        }
        count++
      }
      process.stdout.write('\n') // end the line

      count = 0
      for(let asset of localFiles) {
        if(localFiles.includes(asset)) {
          await updateFile(themeDir + asset, newThemeSettings).catch((err) => {
            if(err.response !== undefined) {
              try {
                if(err.response.status !== 403 && err.response.status !== 422 && err.response.status !== 404) {
                  console.error(err.response)
                }
              } catch(err) {}
            }
          })
        }

        count++
        let percentageDone = ((count / localFiles.length))
        let progressStr = '👸 is hard at work updating files: '.cyan + '🌬 '
        const progressBarLength = 30
        let progressBarIndex = parseInt(30 * percentageDone)
        for(let i = 0; i < progressBarLength; i++) {
          if(i === progressBarIndex) {
            progressStr += '👑'
          }
          else {
            progressStr += ' '
          }
        }
        if(progressBarIndex < progressBarLength) {
          progressStr += '👩   '
        }
        else {
          progressStr += ' 👸   '
        }
        progressStr += count + '/' + localFiles.length + ' (' + (percentageDone * 100).toFixed(0) + '%) so far'
        if(process.env.BUILD_PLATFORM !== 'github') {
          process.stdout.clearLine()
          process.stdout.cursorTo(0)
          process.stdout.write(progressStr)
        }
        else {
          console.log(progressStr)
        }
      }
      if(process.env.BUILD_PLATFORM !== 'github') process.stdout.write('\n') // end the line
      notifier.notify({
          title: '👸 ThemeQueen is pleased 👸',
          message: 'Finished deploying to ' + themeEnv
      })
      resolve('👸 is pleased.'.green + ' Finished deploying.')
    }).catch((err) => {
      reject('👸 is displeased. '.red + 'Something went wrong when fetching the theme assets. \n' + err)
    })
  })
}

function confirmTheme(newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: `https://${newThemeSettings.store}/admin/api/2020-01/themes.json`,
      headers: {
        'X-Shopify-Access-Token': `${newThemeSettings.password}`
      }
    }).then((response) => {
      if(response.data.themes !== undefined) {
        let themeMatch = response.data.themes.filter(theme => theme.id == newThemeSettings.theme_id)
        if(themeMatch.length > 0) {
          let activeTheme = themeMatch.shift()
          if(activeTheme.role !== 'main') {
            console.log('👸 is pleased.'.green + ' ' + activeTheme.name.cyan + ' is unpublished.')
            resolve(true)
          }
          else {
            if(shouldForce) {
              console.log('👸 is feeling powerful.'.magenta + ' ' + activeTheme.name.cyan + ' is currently published, but deployment was forced through.')
              resolve(true)
            }
            else if (readlineSync.keyInYN('👸 is curious. '.magenta +  activeTheme.name.cyan + ' is currently published. Are you sure you want to deploy?')) {
              resolve(true)
            }
            else {
                reject('👸 is satisfied. '.cyan + 'Theme deploy was cancelled manually.')
            }
          }
        }
        else {
          reject('👸 is displeased. '.red + 'The theme ID doesn\'t match any on the shop. Double check your settings, and try again.')
        }
      }
      else {
        reject('👸 is displeased. '.red + 'Can\'t seem to find any themes on this shop.')
      }
    }).catch((err) => {
      reject('👸 is displeased. '.red + 'Something went wrong when confirming the theme. \n' + err)
    })
  })
}

function getAllFiles(dirPath, arrayOfFiles) {
  files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, '/', file).replace(themeDir, ''))
    }
  })

  return arrayOfFiles
}

var watchQueue = []
async function watch(newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    confirmTheme(newThemeSettings).then((response) => {
      startFileQueue()
      console.log('👸 is pleased. '.green + 'Started watching files in the "' + themeDir + '" directory.')
      watcher = chokidar.watch(themeDir, {}).on('change', function(filename, stats) {
        if(filename.includes('/')) {
          watchQueue.push(
            function() {
              return new Promise((resolve, reject) => {
                monitorFiles(filename, newThemeSettings).then((response) => {
                  resolve(response)
                }).catch((err) => {
                  reject(err)
                })
              })
            }
          )
        }
        else {
          console.log('👸 is curious. '.magenta + 'It seems you are changing config files. You might want to restart this process.')
        }
      })
      watcher.on('unlink', function(filename, stats) {
        if(filename.includes('/')) {
          filename = filename.replace(themeDir, '')
          watchQueue.push(
            function() {
              return new Promise((resolve, reject) => {
                monitorFiles(filename, newThemeSettings).then((response) => {
                  resolve(response)
                }).catch((err) => {
                  reject(err)
                })
              })
            }
          )
        }
        else {
          console.log('👸 is curious. '.magenta + 'It seems you are changing config files. You might want to restart this process.')
        }
      })
      watcher.on('close', (dat) => {
        clearInterval(fileQueueInterval)
        resolve(dat)
      })
      watcher.on('error', (dat) => {
        clearInterval(fileQueueInterval)
        reject(dat)
      })

      if(shouldOpen) open(newThemeSettings).then((res) => {console.log(res)}).catch((err) => {console.error(err)})
    }).catch((err) => {
      clearInterval(fileQueueInterval)
      reject(err)
    })
  })
}

async function deploy(newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    confirmTheme(newThemeSettings).then((response) => {
      uploadTheme(newThemeSettings).then((response) => {
        if(shouldOpen) open(newThemeSettings).then((res) => {console.log(res)}).catch((err) => {console.error(err)})
        resolve(response)
      }).catch((err) => {
        reject(err)
      })
    }).catch((err) => {
      reject(err)
    })
  })
}

async function open(newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    var spawn = require('child_process').spawn;
    var url = `https://${newThemeSettings.store}?preview_theme_id=${newThemeSettings.theme_id}`
    var process = spawn('open', [url]);

    process.stdout.on('data', function (data) {
      process.kill()
      resolve('👸 is curious. '.magenta + 'Received some data from the process: ' + data)
    });

    process.stderr.on('data', (data) => {
      process.kill()
      reject('👸 is displeased. '.red + 'Couldn\'t open the theme due to an error: ' + data)
    });

    process.on('close', (code) => {
      process.kill()
      resolve('👸 is pleased. '.green + 'Opened theme preview here: ' + url.magenta)
    });

    process.on('error', (err) => {
      process.kill()
      reject('👸 is displeased. '.red + 'Couldn\'t open the theme due to an error: ' + data)
    });
  })
}

function link(newThemeSettings) {
  if(newThemeSettings === undefined) newThemeSettings = themeSettings
  return new Promise((resolve, reject) => {
    let url = `https://${newThemeSettings.store}?preview_theme_id=${newThemeSettings.theme_id}`
    resolve(`👸 has fetched the URL for the theme ${themeEnv.cyan}: ${url.yellow}`)
  })
}

module.exports = {
  watch,
  deploy,
  open,
  link,
  init
}