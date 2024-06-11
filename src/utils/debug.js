/**
 * @summary A small wrapper around the Debug package to setup the namespace.
 * @module @mattduffy/albums
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/utils/debug.js A small wrapper around the Debug package to setup the namespace.
 */

import Debug from 'debug'

const _log = Debug('LOG')
_log.log = console.log.bind(console)
const _info = Debug('INFO')
_info.log = console.info.bind(console)
const _warn = Debug('WARN')
_warn.log = console.warn.bind(console)
const _error = Debug('ERROR')
_error.log = console.error.bind(console)

export {
  _log,
  _info,
  _warn,
  _error,
}
