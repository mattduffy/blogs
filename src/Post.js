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
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('post')
const _error = _Error.extend('post')
const POSTS = 'posts'
const MAX_SLUG_LENGTH = process.env.MAX_SLUG_LENGTH || 80

/**
 * A class to model the shape and properties of a single blog post.
 * @summary A class to model the shape and properties of a single blog post.
 * @class Post
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Post {
  #db

  #mongo

  #collection

  #redis

  #newPost

  #_id

  #title

  #slug

  #description

  #content

  #keywords

  #authors

  #createdOn

  #editedOn

  #images

  #postJson

  #noop

  /**
   * Create an instance of a blog post.
   * @summary Create an instance of a blog post.
   * @author Matthew Duffy <mattdufffy@gmail.com>
   * @param { MongoClient|Collection } mongo - Either a mongodb client connection or its blog collection.
   * @param { Object } o - An object with post details to create instance.
   * @param { ObjectId } [o.id] - The ObjectId of the post in the db.
   * @param { String } [o.title] - The title of the post.
   * @param { String } [o.slug] - The url slug for the post.
   * @param { String } [o.description=null] - An optional text description of the post.
   * @param { String } [o.content] - The main text content of the post.
   * @param { String[] } [o.keywords=null] - An optinoal array of keywords for the post.
   * @param { String|String[] } [o.authors] - An author's name, or an array of more than one authors of the post.
   * @param { Object[] } [o.images=null] - An optional array of images linked in the post.
   * @param { Boolean } [o.newPost] - True if creating a new post, false otherwise.
   * @param { Redis } redis - A redis client connection instance.
   * @return { Post } The populuated post instance.
   */
  constructor(mongo, o, redis) {
    // private properties
    const log = _log.extend('constructor')
    const error = _error.extend('constructor')
    this.#newPost = o?.newPost ?? false
    this.#redis = redis ?? null
    this.#mongo = o?.mongo ?? o?.db ?? null
    if ((!o.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      log('no collection provided: ', this.#mongo)
      this.#db = this.#mongo.db(o.dbName).collection(POSTS)
    } else if (o.collection?.collectionName !== undefined) {
      log('db.collection:', o.collection?.collectionName)
      this.#db = o.collection
    } else {
      this.#db = null
      error('config.dbName:     ', o.dbName)
      error('config.collection: ', o.collection)
      error('config.mongo:      ', o.mongo)
    }
    this.#newPost = !!o?.newPost
    this.#_id = (!o?.id) ? new ObjectId() : o.id
    this.#title = o?.title ?? null
    this.#slug = o?.slug ?? null
    this.#description = o?.description ?? null
    this.#content = o?.content
    if (o?.keywords) {
      this.#keywords = new Set(o.keywords)
    } else {
      this.#keywords = new Set()
    }
    if (o.authors.constructor === String) {
      this.#authors = [o.authors]
    } else {
      this.#authors = o.authors
    }
    this.#images = o?.images ?? []
  }

  /**
   * Save the post to db.
   * @summary Save the post to db.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @return { Post|Boolean } - Return value of this, or false if save failed.
   */
  async save() {
    const log = _log.extend('save')
    const error = _error.extend('save')
    if (!this.#db) {
      const msg = `No connection to client collection ${POSTS}`
      error(msg)
      throw new Error(msg)
    }
    log(this.#newPost)
    if (this.#newPost && !this.#_id) {
      this.#_id = new ObjectId()
      log('creating an new ObjectId _id..')
    }
    log(`the _id is ${this.#_id}`)
    if (!this.#postJson) {
      this.#postJson = await this.createPostJson()
    }
    log(this.#postJson)
    let saved
    let filter
    
  }

  /**
   *
   */
  createPostJson() {

  }

  set id(Id) {
    this.#_id = Id
  }

  get id() {
    return this.#_id
  }

  set title(t) {
    this.#title = t
  }

  get title() {
    return this.#title
  }

  set slug(t) {
    this.#slug = t
  }

  get slug() {
    return this.#slug
  }

  set url(t) {
    this.#slug = t
  }

  get url() {
    return this.#slug
  }

  set description(d) {
    this.#description = d
  }

  get description() {
    return this.#description
  }

  set desc(d) {
    this.#description = d
  }

  get desc() {
    return this.#description
  }

  set content(c) {
    this.#content = c
  }

  get content() {
    return this.#content
  }

  set keywords(k) {
    this.#keywords = new Set(k)
  }

  get keywords() {
    return Array.from(this.#keywords)
  }

  set keyword(k) {
    this.#keywords.add(k)
  }

  set images(i) {
    this.#noop = i
  }

  get images() {
    return this.#images
  }

  set image(i) {
    this.#images.push(i)
  }
}
export { Post }
