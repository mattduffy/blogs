/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Post class definition file.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _info as Info,
  _warn as Warn,
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('post')
const _info = Info.extend('post')
const _warn = Warn.extend('post')
const _error = _Error.extend('post')
const POSTS = 'posts'
const MAX_SLUG_LENGTH = 25

/**
 * A class to model the shape and properties of a single blog post.
 * @summary A class to model the shape and properties of a single blog post.
 * @class Post 
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Post {
 
}
export { Post }
