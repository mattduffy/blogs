/**
 * @module @mattduffy/blogs
 * @author Matthew Duffy <mattduffy@gmail.com>
 * @file src/index.js The Post class definition file.
 */

// import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { Album } from '@mattduffy/albums' // eslint-disable-line import/no-unresolved
import { Albums } from '@mattduffy/albums/Albums' // eslint-disable-line import/no-unresolved
import { slugify, MAX_SLUG_LENGTH } from './utils/slugify.js'
import { ObjectId } from '../lib/mongodb-client.js'
import {
  _log as Log,
  _error as _Error,
} from './utils/debug.js'

const _log = Log.extend('post')
const _error = _Error.extend('post')
const POSTS = 'posts'
_log(`slug length max: ${MAX_SLUG_LENGTH}`)

/**
 * A class to model the shape and properties of a single blog post.
 * @summary A class to model the shape and properties of a single blog post.
 * @class Post
 * @author Matthew Duffy <mattduffy@gmail.com>
 */
class Post {
  #type = 'Post'

  #db

  #mongo

  #dbName

  #collection

  #redis

  #newPost

  #blogId

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

  #album

  #albumId

  #albumName

  #public

  #postJson

  #temp

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
   * @param { Album } [o.album=null] - An optional album where the images are stored.
   * @param { String } [o.albumId=null] - An optional album _id value.
   * @param { String } [o.albumName=null] - An optional album name to be created for the images.
   * @param { Boolean } [o.newPost] - True if creating a new post, false otherwise.
   * @param { Boolean } [o.public] - True of false.
   * @param { Redis } redis - A redis client connection instance.
   * @return { Post } The populuated post instance.
   */
  constructor(mongo, o, redis) {
    // private properties
    const log = _log.extend('constructor')
    const error = _error.extend('constructor')
    this.#temp = o
    this.#redis = redis ?? null
    // this.#mongo = o?.mongo ?? o?.db ?? null
    this.#mongo = mongo
    if ((!o?.collection) && (!this.#mongo?.s?.namespace?.collection)) {
      // log('no collection provided: ', this.#mongo)
      log('no collection provided, using: ', POSTS)
      this.#db = this.#mongo.collection(POSTS)
    } else if (o.collection?.collectionName !== undefined) {
      log('db.collection:', o.collection?.collectionName)
      this.#db = o.collection
    } else if (o.collection.collectionName !== POSTS) {
      this.#db = o.collection(POSTS)
    } else {
      this.#db = null
      error('config.dbName:     ', o.dbName)
      error('config.collection: ', o.collection)
      error('config.mongo:      ', o.mongo)
    }
    // this.#newPost = !!o?.newPost
    this.#newPost = o?.newPost ?? false
    this.#_id = o?._id ?? o?.id ?? new ObjectId()
    this.#blogId = o?.blogId ?? null
    this.#title = o?.title ?? o?.postTitle ?? null
    this.#slug = o?.slug ?? o?.postSlug ?? null
    this.#description = o?.description ?? o?.postDescription ?? null
    this.#content = o?.content ?? o?.postContent
    this.#createdOn = o?.createdOn ?? o?.postCreatedOn ?? null
    this.#editedOn = o?.editedOn ?? o?.postEditedOn ?? null
    if (o?.keywords) {
      this.#keywords = new Set(o.keywords)
    } else if (o?.postKeywords) {
      this.#keywords = new Set(o.postKeywords)
    } else {
      this.#keywords = new Set()
    }
    if (o?.authors) {
      if (o?.authors?.constructor === String) {
        this.#authors = [o.authors]
      } else {
        this.#authors = o?.authors ?? null
      }
    } else if (o?.postAuthors) {
      if (o?.postAuthors?.constructor === String) {
        this.#authors = [o.postAuthors]
      } else {
        this.#authors = o?.postAuthors ?? null
      }
    }
    this.#albumId = o?.albumId ?? o?.postAlbumId ?? null
    this.#albumName = o?.albumName ?? o?.postAlbumName ?? null
    this.#images = o?.images ?? o?.postImages ?? []
    this.#public = o?.public ?? o?.postPublic ?? false
  }

  /**
   * A custom toString() method.
   * @summary A custom toString() method.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @return { String }
   */
  toString() {
    const p = 16
    let str = 'Post configuration details:\n'
              + `${'title:'.padEnd(p)} ${this.title}`
              + `\n{'id:'.padEnd(p)} ObjectId(${this.#_id})`
              + `\n{'new post?'.padEnd(p)} ${this.#newPost}`
              + `\n{'authors:'.padEnd(p)} ${this.#authors}`
              + `\n{'slug:'.padEnd(p)} ${this.#slug}`
              + `\n{'created:'.padEnd(p)} ${this.#createdOn}`
    if (this.#albumId) {
      str += `\n${'album id:'.padEnd(p)} ObjectId(${this.#albumId})`
    }
    return str
  }

  /**
  */
  async init() {
    const log = _log.extend('init')
    const error = _error.extend('init')
    if (!this.#newPost) {
      let found
      try {
        const query = { _id: new ObjectId(this.#_id) }
        log(query)
        found = await this.#db.findOne(query)
        log(found)
        if (!this.#temp?.title) {
          this.#title = found.title
        }
        if (!this.#temp?.authors) {
          this.#authors = found.authors
        }
        if (!this.#temp?.createdOn) {
          this.#createdOn = found.createdOn
        }
        if (!this.#temp?.editedOn) {
          this.#editedOn = found.editedOn
        }
        if (!this.#temp?.images) {
          this.#images = found.images
        }
        if (!this.#temp?.slug) {
          this.#slug = found.slug
        }
      } catch (e) {
        const msg = 'Failed to init post instance.'
        error(msg)
        throw new Error(msg, { cause: e })
      }
      try {
        this._album = await Albums.getById(this.#albumId)
      } catch (e) {
        const msg = `Failed to retrieve album: ${this.#albumId}`
        error(msg)
        error(e)
        throw new Error(msg, { cause: e })
      }
    }
    return this
  }

  /**
   * Create an album to store images for this post.
   * @summary Create an album to store image for this post.
   * @author Matthew Duffy <mattduffy@gmail.com>
   * @async
   * @param { Object } config - An object literal with album config values.
   * @param { Collection } config.collection - A client connection to the albums collection.
   * @param { String } config.rootDir - A path to the root of the users galleries directory.
   * @param { String } config.albumUrl - A path to the album directory inside galleryRoot.
   * @param { String } config.albumOwner - The name of the owner of the gallery/album.
   * @param { String } config.albumDescription - A short description of the gallery/album.
   * @return { undefined }
   */
  async createAlbum(config) {
    const log = _log.extend('createAlbum')
    const error = _error.extend('createAlbum')
    try {
      const name = `post-${this.#slug}`
      const c = {
        ...config,
        albumName: name,
        slug: slugify(name),
        rootDir: config.rootDir,
        albumDir: `${config.rootDir}/${name}`,
        albumUrl: `@${config.owner}/galleries/${slugify(name)}`,
        new: true,
        public: false,
        postId: this.#_id,
      }
      log('customizing post album config: ', c)
      log(`making album directory: ${c.albumDir}`)
      await mkdir(c.albumDir, { recursive: true })
      const skip = { sizes: true, metadata: true }
      this.#album = await new Album(c).init(null, skip)
      log(`Created new post album with name ${c.albumName}, _id: ${this.#album.id}`)
      log(this.#album.toString())
      // album._id not available yet
      // this.#albumId = this.#album.id
    } catch (e) {
      const msg = 'Failed to create post album.'
      error(msg)
      error(e)
      throw new Error(msg, { cause: e })
    }
    return this.#album
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
    log(`is this a new post? ${this.#newPost}`)
    if (this.#newPost && !this.#_id) {
      this.#_id = new ObjectId()
      log('creating an new ObjectId _id..')
    }
    log(`the _id is ${this.#_id}`)
    log(`the album.id is ${this.#albumId}`)
    if (this.#newPost) {
      this.#createdOn = new Date()
    } else {
      this.#editedOn = new Date()
    }
    // if (!this.#postJson) {
    //   this.#postJson = this.createPostJson()
    // }
    log('creating the post json document.')
    this.#postJson = this.createPostJson()
    log('post json doc: ', this.#postJson)
    let saved
    let filter
    let options
    let update
    try {
      filter = { $and: [{ _id: new ObjectId(this.#_id) }, { blogId: new ObjectId(this.#blogId) }] }
      update = {
        $set: this.#postJson,
      }
      if (this.#newPost) {
        options = { upsert: true }
      } else {
        options = {}
        delete update.$set._id
      }
      log('save filter: ', filter)
      log('options:     ', options)
      log('save doc:    ', update)
      saved = await this.#db.updateOne(filter, update, options)
      log(saved)
    } catch (e) {
      const err = 'Failed to save/update post.'
      error(err)
      error(e)
      throw new Error(err, { cause: e })
    }
    this.#newPost = false
    log('updated and saved post: ', this.toString())
    return this
  }

  /**
   * Create a json document with post details suitable for saving in db.
   * @summary Create a json document with post details suitable for saving in db.
   * @author Matthew Duffy <mattduffy@gmail.c>m>
   * @return { Object } JSON document with post details.
   */
  createPostJson() {
    const log = _log.extend('createPostJson')
    // if (this.#postJson) return this.#postJson
    const tmp = {
      _id: new ObjectId(this.#_id),
      blogId: new ObjectId(this.#blogId),
      // albumId: new ObjectId(this.#albumId),
      title: this.#title,
      slug: this.#slug,
      description: this.#description,
      content: this.#content,
      keywords: Array.from(this.#keywords),
      authors: this.#authors,
      images: this.#images,
      public: this.#public,
      createdOn: this.#createdOn,
      editedOn: this.#editedOn,
    }
    tmp.albumId = (this.#albumId) ? new ObjectId(this.#albumId) : null
    log(tmp)
    return tmp
  }

  set id(Id) {
    this.#_id = Id
  }

  get id() {
    return this.#_id
  }

  get authors() {
    return this.#authors
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

  set albumId(id) {
    _log(`setting album id: ${id}`)
    this.#albumId = id
    _log(`set album id: ${this.#albumId}`)
  }

  get albumId() {
    _log(`returning album id: ${this.#albumId}`)
    return this.#albumId
  }

  get images() {
    return this.#images
  }

  set image(i) {
    const len = this.#images.length
    if (this.#images[0] !== undefined) {
      this.#images.push(i)
    } else if (len === 0) {
      this.#images[1] = i
    } else {
      this.#images.push(i)
    }
  }

  get previewImg() {
    return this.#images[0]
  }

  set previewImg(i) {
    this.#images[0] = i
  }

  set public(p) {
    this.#public = p
  }

  get public() {
    return this.#public
  }

  get blogId() {
    return this.#blogId
  }

  get createdOn() {
    return this.#createdOn
  }

  get editedOn() {
    return this.#editedOn
  }

  get postJson() {
    return this.#postJson
  }

  get [Symbol.toStringTag]() {
    return this.#type
  }
}
export { Post }
