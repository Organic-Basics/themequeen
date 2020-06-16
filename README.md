# 👸🏻 themequeen 

*Themekit is dead. Long live Themequeen!*

ThemeQueen is an alternative to Shopify's Themekit, written 100% in Node.js.

![Themequeen in action](https://github.com/Organic-Basics/themequeen/raw/master/themequeen.gif "Themequeen in action")

## Installation

### Yarn 
`yarn add themequeen --dev`

### npm

`npm i themequeen --save-dev`

## Setup

To start using, you must first _require_ and _initialize_ themequeen

```
const queen = require('../themequeen')

// See Options for more on how to configure the initializer
queen.init(opts)
```

### Config

Themequeen uses a similar config setup as themekit. To make it work you need two files: `variables` and `config.yml`.

Both files need to be located in the same folder as the rest of the theme files. Usually this is the `theme` folder, but you can name it whatever you like.

You can see the Themequeen `theme` folder for an example of the desired folder structure.

#### config.yml

Themequeen currently only supports theme IDs, passwords and store URLs as part of the config.
Those are entered into the `config.yml` file located in the same directory as the rest of the theme files.

The structure is:

```
themename:
  password: ${PASSWORD_VAR}
  theme_id: ${THEME_ID_VAR}
  store: ${URL_VARIABLE}
```

#### variables

To promote the user of keeping API keys secret, Themequeen also enforces the use of a `variables` file(no file ending) similarly located in the theme directory.

```
PASSWORD_VAR=123456abcdef
THEME_ID_VAR=1234567890
URL_VARIABLE=devshop.myshopify.com
```

### Options
The following are the possible options for the `init()` function.

```
// default values listed
{
  // Which directory to use when watching and deploying files?
  // Also determines the location of the variables and config.yml files. 
  themeDir: 'theme/', 
  // Changes the speed of themequeen uploads to match Shopify Plus API rate limits
  isShopifyPlus: false
}
```

## Usage

Themequeen exposes 4 different functions for development usage:
`watch`, `deploy`, `open`, and `link`.

There are 2 different ways to customize their usage:
1. By using terminal arguments like `--tqenv`, `--tqopen` and `--tqforce`
2. By supplying new configs via the function call itself

For #1, see _Command line arguments_. For #2, see _Function configs_.

### Command line arguments

When built into a command line interface, like Gulp, Themequeen can watch for specific command line arguments as well. 

`--tqenv` allows you to supply a themename to use from the config.yml file. E.g. `--tqenv production`

`--tqopen` tells Themequeen to open a preview link with that theme upon finishing the task. Only works with `watch` and `deploy`.

`--tqforce` tells Themequeen to ignore any warnings of published themes. Provided as a helper for impatient developers. 

### Function configs

Instead of relying on the `config.yml` file to give us info on theme configs, Themequeen can also take configs as an argument.

Same rules as `config.yml` apply, except the format is in JSON. So the structure becomes:
```
{
  name: 'themename',
  password: '123456abcdef',
  theme_id: '1234567890',
  store: 'devshop.myshopify.com'
}
```

### watch

`queen.watch(themeConfig)`

`themeConfig` is an optional argument. See _Function configs_ for more.

Watches the files in the theme directory, and applies any changes to the Shopify theme. 

New files are added, updated files are changed, and deleted files are removed. 

Returns a Promise that resolves upon closing the process.

### deploy

`queen.deploy(themeConfig)`

`themeConfig` is an optional argument. See _Function configs_ for more.

Goes through three processes:
1. Deletes all files from the Shopify theme not found in the theme directory.
2. Uploads any files present in the theme directory, but not found in the Shopify theme.
3. Uploads any files present in both.

Returns a Promise that resolves upon finished deployment.

### open

`queen.open(themeConfig)`

`themeConfig` is an optional argument. See _Function configs_ for more.

Opens a preview link in the user's default browser.

Returns a Promise that resolves upon successfully opening the link.

### link

`queen.link(themeConfig)`

`themeConfig` is an optional argument. See _Function configs_ for more.

Returns a Promise that resolves with a preview link URL for the given theme.

## Differences from themekit

There are couple of notable differences to Themekit and Themequeen. 

|Feature|👸🏻 Themequeen 👸🏻|Themekit|
|-|:-:|:-:|
|Warning before updating published themes|✔️|❌|
|Built in Node.js|✔️|❌|
|Plays nicely with Gulp and Webpack|✔️|❌|
|Increased speed for Shopify Plus|✔️|❌|
|Programmatic first, CLI second|✔️|❌|
|Cute console.log messages|✔️|❌|

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
No license at all. 100% open source. 